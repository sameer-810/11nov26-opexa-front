import { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { formatDate, formatMoney } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { s, useData } from '../../inventory/ui';
import { canPayExpenses, canSeeExpenseReport, expenseApi, STATUS_LABEL, statusTone } from '../expenseApi';

type Props = NativeStackScreenProps<RootStackParamList, 'MyExpenses'>;

// The employee's own expense vouchers with their status; sent-back ones open for editing.
export function MyExpensesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const fetcher = useCallback(() => expenseApi.mine(), []);
  const { data, error, reload } = useData(fetcher);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return (
    <AppScreen
      title="My expenses"
      subtitle="Claim what you spent for the company, with the receipt"
      onBack={() => navigation.navigate('Dashboard')}
      right={
        <View style={s.row}>
          {canPayExpenses(user) ? <Button title="To pay" variant="ghost" onPress={() => navigation.navigate('ExpensesToPay')} testID="open-expenses-to-pay" /> : null}
          {canSeeExpenseReport(user) ? <Button title="Report" variant="ghost" onPress={() => navigation.navigate('ExpenseReport')} testID="open-expense-report" /> : null}
          {can(user, PERMS.SETTINGS_MANAGE) ? <Button title="Categories" variant="ghost" onPress={() => navigation.navigate('ExpenseCategories')} testID="open-expense-categories" /> : null}
        </View>
      }
      testID="my-expenses-screen"
    >
      <Button title="New expense" onPress={() => navigation.navigate('NewExpense')} testID="exp-new" />
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!data && !error ? <ActivityIndicator /> : null}
      {data?.length === 0 ? <EmptyState title="No expenses yet" /> : null}
      <View style={s.list}>
        {data?.map((e) => (
          <Pressable key={e.id} style={s.card} onPress={() => navigation.navigate('ExpenseForm', { id: e.id })} testID={`exp-${e.number}`}>
            <View style={s.row}>
              <Text style={s.number}>{e.number}</Text>
              <StatusChip label={STATUS_LABEL[e.status]} tone={statusTone(e.status)} />
            </View>
            <Text style={s.title}>{formatMoney(e.amount)} · {e.category}</Text>
            <Text style={s.muted}>{formatDate(e.date)} · {e.projectCode ? `${e.projectCode} ${e.projectName}` : 'Office'} · {e.note}</Text>
            {e.status === 'sent_back' ? <Text style={s.warn}>Sent back: {e.reviewComment} — tap to edit and resubmit</Text> : null}
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
