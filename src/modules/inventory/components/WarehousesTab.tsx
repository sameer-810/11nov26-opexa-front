import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import type { Warehouse } from '../types';
import { s, useAction, useData } from '../ui';

const ACTIVE = [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }];

// Warehouses: add one, or edit its name, code, address and whether it is in use (admins only).
export function WarehousesTab() {
  const { data, error, reload } = useData(inventoryApi.warehouses);
  const [editing, setEditing] = useState(''); // '' none, 'new', or a warehouse id
  const done = () => { setEditing(''); void reload(); };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <View style={s.list} testID="warehouses-tab">
      {editing === 'new' ? <WarehouseForm onDone={done} onCancel={() => setEditing('')} /> : <Button title="Add warehouse" onPress={() => setEditing('new')} testID="warehouse-add" style={s.self} />}
      {data.map((w) => (
        <View key={w.id} style={s.card} testID={`warehouse-${w.code}`}>
          <View style={s.row}>
            <Text style={s.number}>{w.code}</Text>
            <Text style={s.title}>{w.name}</Text>
            {w.isCentral ? <StatusChip label="Central Store" tone="info" /> : null}
            {!w.isActive ? <StatusChip label="Inactive" tone="neutral" /> : null}
          </View>
          {w.address ? <Text style={s.muted}>{w.address}</Text> : null}
          {editing === w.id ? <WarehouseForm w={w} onDone={done} onCancel={() => setEditing('')} /> : <Button title="Edit" variant="ghost" onPress={() => setEditing(w.id)} testID={`warehouse-edit-${w.code}`} style={s.self} />}
        </View>
      ))}
    </View>
  );
}

function WarehouseForm({ w, onDone, onCancel }: { w?: Warehouse; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(w?.name ?? '');
  const [code, setCode] = useState(w?.code ?? '');
  const [address, setAddress] = useState(w?.address ?? '');
  const [active, setActive] = useState(w?.isActive === false ? 'no' : 'yes');
  const { busy, problem, run, setProblem } = useAction(onDone);
  const save = () => {
    if (name.trim().length < 2) return setProblem('Enter the warehouse name');
    const body = { name: name.trim(), code: code.trim() || undefined, address: address.trim() };
    return run('save', () => (w ? inventoryApi.updateWarehouse(w.id, { ...body, isActive: w.isCentral ? undefined : active === 'yes' }) : inventoryApi.createWarehouse({ ...body, address: body.address || undefined })));
  };
  return (
    <View style={s.form} testID="warehouse-form">
      {problem ? <ErrorBanner message={problem} testID="warehouse-problem" /> : null}
      <View style={s.row}>
        <View style={s.cell}><TextField label="Warehouse name" value={name} onChangeText={setName} maxLength={120} testID="warehouse-name" /></View>
        <View style={s.cell}><TextField label="Code" value={code} onChangeText={setCode} maxLength={20} autoCapitalize="characters" placeholder={w ? undefined : 'Automatic if empty'} testID="warehouse-code" /></View>
      </View>
      <TextField label="Address" value={address} onChangeText={setAddress} maxLength={300} testID="warehouse-address" />
      {w && !w.isCentral ? <ChoiceChips label="Status" options={ACTIVE} value={active} onChange={setActive} testID="warehouse-active" /> : null}
      <View style={s.row}>
        <Button title={w ? 'Save warehouse' : 'Add warehouse'} onPress={() => void save()} loading={busy === 'save'} testID="warehouse-save" />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
