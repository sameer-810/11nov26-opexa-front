import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { TextField } from '../../../shared/ui/TextField';
import { AttachmentList } from '../../requisition/components/Attachments';
import { s, useAction, useData } from '../../inventory/ui';
import { expenseApi, type PaymentMode } from '../expenseApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpensesToPay'>;
type Draft = { mode: PaymentMode; reference: string; paidDate: string };
const MODES = [{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank transfer' }, { value: 'upi', label: 'UPI' }];

// Accounts: approved expense vouchers waiting for payment; marking one paid puts it in project cost and Tally.
export function ExpensesToPayScreen({ navigation }: Props) {
  const fetcher = useCallback(() => expenseApi.report({ status: 'approved' }), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftOf = (id: string): Draft => drafts[id] ?? { mode: 'bank', reference: '', paidDate: todayLocal() };
  const edit = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...draftOf(id), ...patch } }));
  const pay = (id: string) => {
    const d = draftOf(id);
    if (d.mode !== 'cash' && !d.reference.trim()) return setProblem('Enter the bank / UPI reference');
    return run(`pay-${id}`, () => expenseApi.pay(id, { mode: d.mode, reference: d.reference.trim() || undefined, paidDate: d.paidDate }));
  };

  if (error) return <AppScreen title="Expenses to pay" onBack={() => navigation.navigate('MyExpenses')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  return (
    <AppScreen title="Expenses to pay" subtitle={data ? `${data.total.count} approved · ${formatMoney(data.total.amount)}` : undefined} onBack={() => navigation.navigate('MyExpenses')} testID="expenses-to-pay-screen">
      {problem ? <ErrorBanner message={problem} testID="pay-problem" /> : null}
      {!data ? <ActivityIndicator /> : null}
      {data?.rows.length === 0 ? <EmptyState title="Nothing waiting for payment" /> : null}
      <View style={s.list}>
        {data?.rows.map((e) => {
          const d = draftOf(e.id);
          return (
            <View key={e.id} style={s.card} testID={`pay-${e.number}`}>
              <Text style={s.number}>{e.number} · {formatMoney(e.amount)}</Text>
              <Text style={s.title}>{e.employee?.name} · {e.category}</Text>
              <Text style={s.muted}>{formatDate(e.date)} · {e.projectCode ? `${e.projectCode} ${e.projectName}` : 'Office'} · {e.note}</Text>
              <AttachmentList items={e.attachments} onError={setProblem} fetchFile={(a) => expenseApi.downloadAttachment(e.id, a)} />
              <ChoiceChips label="Paid by" value={d.mode} onChange={(v) => edit(e.id, { mode: v as PaymentMode })} options={MODES} testID={`pay-mode-${e.number}`} />
              <View style={s.row}>
                <View style={s.cell}><TextField label={d.mode === 'cash' ? 'Reference (optional)' : 'Reference'} value={d.reference} onChangeText={(v) => edit(e.id, { reference: v })} maxLength={80} testID={`pay-ref-${e.number}`} /></View>
                <View style={s.cell}><TextField label="Paid on (YYYY-MM-DD)" value={d.paidDate} onChangeText={(v) => edit(e.id, { paidDate: v })} testID={`pay-date-${e.number}`} /></View>
              </View>
              <Button title="Mark paid" onPress={() => void pay(e.id)} loading={busy === `pay-${e.id}`} testID={`pay-submit-${e.number}`} />
            </View>
          );
        })}
      </View>
    </AppScreen>
  );
}
