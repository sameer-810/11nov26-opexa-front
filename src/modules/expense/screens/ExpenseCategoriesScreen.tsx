import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { s, useAction, useData } from '../../inventory/ui';
import { expenseApi, type ExpenseCategory } from '../expenseApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseCategories'>;

// Expense category master (settings users): receipt rule, Tally ledger, on/off. Never deleted.
export function ExpenseCategoriesScreen({ navigation }: Props) {
  const fetcher = useCallback(() => expenseApi.categories(true), []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [name, setName] = useState('');
  const [ledgers, setLedgers] = useState<Record<string, string>>({});
  const update = (c: ExpenseCategory, patch: Partial<Omit<ExpenseCategory, 'id'>>) => run(`u-${c.id}`, () => expenseApi.updateCategory(c.id, patch));
  const add = () => (name.trim().length < 2 ? setProblem('Enter a category name') : run('add', async () => { await expenseApi.addCategory({ name: name.trim() }); setName(''); }));

  if (error) return <AppScreen title="Expense categories" onBack={() => navigation.navigate('MyExpenses')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  return (
    <AppScreen title="Expense categories" subtitle="Tally ledger defaults to the category name" onBack={() => navigation.navigate('MyExpenses')} testID="expense-categories-screen">
      {problem ? <ErrorBanner message={problem} testID="cat-problem" /> : null}
      {!data ? <ActivityIndicator /> : null}
      <View style={s.list}>
        {data?.map((c) => (
          <View key={c.id} style={s.card} testID={`cat-${c.name}`}>
            <View style={s.row}>
              <Text style={s.title}>{c.name}</Text>
              <StatusChip label={c.isActive ? 'Active' : 'Off'} tone={c.isActive ? 'success' : 'neutral'} />
              <StatusChip label={c.receiptRequired ? 'Receipt required' : 'No receipt needed'} tone={c.receiptRequired ? 'info' : 'warning'} />
            </View>
            <View style={s.row}>
              <View style={s.cell}><TextField label="Tally ledger" value={ledgers[c.id] ?? c.tallyLedger} onChangeText={(v) => setLedgers((x) => ({ ...x, [c.id]: v }))} maxLength={120} testID={`cat-ledger-${c.name}`} /></View>
              <Button title="Save ledger" variant="outline" onPress={() => void update(c, { tallyLedger: (ledgers[c.id] ?? c.tallyLedger).trim() })} loading={busy === `u-${c.id}`} />
              <Button title={c.receiptRequired ? 'No receipt needed' : 'Require receipt'} variant="ghost" onPress={() => void update(c, { receiptRequired: !c.receiptRequired })} testID={`cat-receipt-${c.name}`} />
              <Button title={c.isActive ? 'Switch off' : 'Switch on'} variant="ghost" onPress={() => void update(c, { isActive: !c.isActive })} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.row}>
        <View style={s.cell}><TextField label="New category" value={name} onChangeText={setName} maxLength={80} testID="cat-name" /></View>
        <Button title="Add" onPress={() => void add()} loading={busy === 'add'} testID="cat-add" />
      </View>
    </AppScreen>
  );
}
