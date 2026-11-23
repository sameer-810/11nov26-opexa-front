import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { AttachmentList, AttachmentPicker } from '../../requisition/components/Attachments';
import type { PickedFile } from '../../requisition/api/requisitionApi';
import { errText, s } from '../../inventory/ui';
import { expenseApi, STATUS_LABEL, statusTone, type Expense, type ExpenseCategory } from '../expenseApi';
import { pickReceiptPhoto, ReceiptError } from '../receipts';

type Props = NativeStackScreenProps<RootStackParamList, 'NewExpense' | 'ExpenseForm'>;
type Form = { categoryId: string; amount: string; date: string; projectId: string; note: string; billNo: string };
const OFFICE = 'office';
const EDITABLE = ['draft', 'sent_back'];

// New expense voucher, a draft / sent-back voucher to edit and (re)submit, or any voucher to read (Q12).
export function ExpenseFormScreen({ navigation, route }: Props) {
  const id = (route.params as { id?: string } | undefined)?.id;
  const [voucher, setVoucher] = useState<Expense | null>(null);
  const [cats, setCats] = useState<ExpenseCategory[] | null>(null);
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [form, setForm] = useState<Form>({ categoryId: '', amount: '', date: todayLocal(), projectId: OFFICE, note: '', billNo: '' });
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [c, p, v] = await Promise.all([expenseApi.categories(), projectApi.list(), id ? expenseApi.get(id) : Promise.resolve(null)]);
      setCats(c); setProjects(p);
      if (v) {
        setVoucher(v);
        setForm({ categoryId: v.categoryId ?? '', amount: String(v.amount), date: v.date, projectId: v.projectId ?? OFFICE, note: v.note, billNo: v.billNo });
      }
    } catch (e) { setLoadError(errText(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const category = cats?.find((c) => c.id === form.categoryId);
  const addPhoto = async (source: 'camera' | 'gallery') => {
    try { const f = await pickReceiptPhoto(source); if (f) setPicked((x) => [...x, f]); } catch (e) { setError(e instanceof ReceiptError ? e.message : 'Could not add the photo'); }
  };

  // Saves the voucher and uploads new receipts; with `andSubmit` sends it for approval.
  const save = async (andSubmit: boolean) => {
    const amount = parseNumber(form.amount);
    if (!form.categoryId) return setError('Choose a category');
    if (!amount || amount <= 0) return setError('Enter the amount');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError('Enter the date as YYYY-MM-DD');
    if (form.note.trim().length < 3) return setError('Describe the expense');
    if (andSubmit && category?.receiptRequired && !(voucher?.attachments.length ?? 0) && !picked.length) return setError('Attach the receipt (photo or PDF)');
    setError(''); setBusy(andSubmit ? 'submit' : 'save');
    try {
      const body = { categoryId: form.categoryId, amount, date: form.date, projectId: form.projectId === OFFICE ? null : form.projectId, note: form.note.trim(), billNo: form.billNo.trim() || undefined };
      let v = voucher ? await expenseApi.update(voucher.id, body) : await expenseApi.create(body);
      setVoucher(v);
      for (const f of picked) v = await expenseApi.addAttachment(v.id, f);
      setPicked([]);
      if (andSubmit) v = await expenseApi.submit(v.id);
      setVoucher(v);
      if (andSubmit) navigation.navigate('MyExpenses');
    } catch (e) { setError(errText(e)); } finally { setBusy(''); }
  };
  const discard = async () => {
    if (!voucher) return navigation.goBack();
    setBusy('discard');
    try { await expenseApi.discard(voucher.id); navigation.navigate('MyExpenses'); } catch (e) { setError(errText(e)); setBusy(''); }
  };
  const removeExisting = async (docId: string) => {
    if (!voucher) return;
    try { setVoucher(await expenseApi.removeAttachment(voucher.id, docId)); } catch (e) { setError(errText(e)); }
  };

  const title = voucher?.number ? `Expense ${voucher.number}` : 'New expense';
  if (loadError) return <AppScreen title={title} onBack={() => navigation.goBack()}><ErrorState message={loadError} onRetry={load} /></AppScreen>;
  if (!cats) return <AppScreen title={title} onBack={() => navigation.goBack()}><ActivityIndicator /></AppScreen>;
  const editable = !voucher || EDITABLE.includes(voucher.status);

  return (
    <AppScreen title={title} subtitle="Manager, then Accounts approve; Accounts pay" onBack={() => navigation.navigate('MyExpenses')} testID="expense-form-screen">
      {voucher ? (
        <View style={s.row}>
          <StatusChip label={STATUS_LABEL[voucher.status]} tone={statusTone(voucher.status)} testID="exp-status" />
          {voucher.employee?.name ? <Text style={s.muted}>{voucher.employee.name}</Text> : null}
        </View>
      ) : null}
      {voucher?.reviewComment ? <Text style={s.warn} testID="exp-review-comment">Approver: {voucher.reviewComment}</Text> : null}
      {voucher?.payment ? <Text style={s.muted} testID="exp-payment">Paid {formatDate(voucher.payment.paidDate)} by {voucher.payment.mode.toUpperCase()}{voucher.payment.reference ? ` · ${voucher.payment.reference}` : ''}</Text> : null}
      {voucher?.voided ? <Text style={s.danger}>Void: {voucher.voided.reason}</Text> : null}

      {editable ? (
        <View style={s.form}>
          <ChoiceChips label="Category" value={form.categoryId} onChange={set('categoryId')} options={cats.map((c) => ({ value: c.id, label: c.name, hint: c.receiptRequired ? undefined : 'no receipt needed' }))} testID="exp-category" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Amount ₹" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" testID="exp-amount" /></View>
            <View style={s.cell}><TextField label="Date (YYYY-MM-DD)" value={form.date} onChangeText={set('date')} testID="exp-date" /></View>
            <View style={s.cell}><TextField label="Bill no. (optional)" value={form.billNo} onChangeText={set('billNo')} maxLength={60} testID="exp-bill" /></View>
          </View>
          <ChoiceChips label="For" value={form.projectId} onChange={set('projectId')} options={[{ value: OFFICE, label: 'Office (no project)' }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]} testID="exp-project" />
          <TextField label="Description" value={form.note} onChangeText={set('note')} maxLength={500} testID="exp-note" />
          <AttachmentPicker picked={picked} onPick={setPicked} existing={voucher?.attachments ?? []} onRemoveExisting={(a) => void removeExisting(a.id)} />
          <View style={s.row}>
            <Button title="Take photo" variant="outline" onPress={() => void addPhoto('camera')} testID="exp-camera" />
            <Button title="From gallery" variant="outline" onPress={() => void addPhoto('gallery')} testID="exp-gallery" />
          </View>
          {category && !category.receiptRequired ? <Text style={s.muted}>No receipt needed for {category.name}.</Text> : null}
          {error ? <ErrorBanner message={error} testID="exp-error" /> : null}
          <View style={s.row}>
            <Button title={voucher?.status === 'sent_back' ? 'Resubmit' : 'Submit'} onPress={() => void save(true)} loading={busy === 'submit'} testID="exp-submit" />
            <Button title="Save draft" variant="outline" onPress={() => void save(false)} loading={busy === 'save'} testID="exp-save" />
            {!voucher || voucher.status === 'draft' ? <Button title="Discard" variant="ghost" onPress={() => void discard()} loading={busy === 'discard'} testID="exp-discard" /> : null}
          </View>
        </View>
      ) : voucher ? (
        <View style={s.card} testID="exp-readonly">
          <Text style={s.title}>{formatMoney(voucher.amount)} · {voucher.category}</Text>
          <Text style={s.muted}>{formatDate(voucher.date)} · {voucher.projectCode ? `${voucher.projectCode} ${voucher.projectName}` : 'Office'}{voucher.billNo ? ` · bill ${voucher.billNo}` : ''}</Text>
          <Text style={s.muted}>{voucher.note}</Text>
          <AttachmentList items={voucher.attachments} onError={setError} fetchFile={(a) => expenseApi.downloadAttachment(voucher.id, a)} />
          {error ? <ErrorBanner message={error} /> : null}
        </View>
      ) : null}
    </AppScreen>
  );
}
