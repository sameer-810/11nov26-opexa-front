import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatDateTime } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { s } from '../inventory/ui';
import type { DriveAttachment, DriveDoc } from './driveApi';

type DocProps = {
  d: DriveDoc; canWrite: boolean; canManage: boolean; busy: string;
  onDownload: (d: DriveDoc, version: number) => void; onNewVersion: (d: DriveDoc) => void;
  onComment: (d: DriveDoc, text: string) => Promise<boolean>; onArchive: (d: DriveDoc, reason: string) => void; onRestore: (d: DriveDoc) => void;
};

// One uploaded document (or meeting note): versions, comments, archive / restore.
export function DocCard({ d, canWrite, canManage, busy, onDownload, onNewVersion, onComment, onArchive, onRestore }: DocProps) {
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const note = d.kind === 'note';
  return (
    <View style={s.card} testID={`doc-${d.title}`}>
      <View style={s.row}>
        <Text style={s.title}>{d.title}</Text>
        {note ? <StatusChip label="Meeting note" tone="info" /> : <StatusChip label={`v${d.currentVersion}`} tone="info" />}
        {d.restricted ? <StatusChip label="Managers only" tone="warning" /> : null}
        {d.archived ? <StatusChip label="Archived" tone="neutral" /> : null}
        <Text style={s.muted}>{d.folder}{d.linkedTo ? ` · ${d.linkedTo.label || d.linkedTo.type}` : ''}</Text>
      </View>
      {note && d.meeting ? (
        <View testID={`note-${d.title}`}>
          <Text style={s.muted}>{d.meeting.date}{d.meeting.attendees.length ? ` · ${d.meeting.attendees.join(', ')}` : ''}</Text>
          <Text>{d.meeting.text}</Text>
        </View>
      ) : null}
      {d.archived ? <Text style={s.muted}>Archived {formatDateTime(d.archived.at)}: {d.archived.reason}</Text> : null}
      {d.versions.slice().reverse().map((v) => (
        <View key={v.version} style={s.row}>
          <Text style={[s.muted, s.cell]}>v{v.version} · {v.name} · {formatDateTime(v.at)}{v.note ? ` · ${v.note}` : ''}</Text>
          <Button title="Download" variant="ghost" onPress={() => onDownload(d, v.version)} testID={`doc-dl-${d.title}-${v.version}`} />
        </View>
      ))}
      {!note && canWrite && !d.archived ? <View style={s.row}><Button title="Upload new version" variant="outline" onPress={() => onNewVersion(d)} loading={busy === `up-${d.title}`} /></View> : null}
      {d.comments.map((c) => <Text key={c.id} style={s.muted}>{c.byName}, {formatDateTime(c.at)}: {c.text}</Text>)}
      {canWrite && !d.archived ? (
        <View style={s.row}>
          <View style={s.cell}><TextField label="Note / comment" value={text} onChangeText={setText} testID={`doc-comment-${d.title}`} /></View>
          <Button title="Add" variant="outline" onPress={async () => { if (await onComment(d, text)) setText(''); }} testID={`doc-comment-save-${d.title}`} />
        </View>
      ) : null}
      {canWrite && !d.archived && !archiving ? <Button title="Archive" variant="ghost" onPress={() => setArchiving(true)} testID={`doc-archive-${d.title}`} /> : null}
      {archiving ? (
        <View style={s.row}>
          <View style={s.cell}><TextField label="Why archive it?" value={reason} onChangeText={setReason} placeholder="e.g. Superseded by R2" testID={`doc-archive-reason-${d.title}`} /></View>
          <Button title="Archive" variant="outline" disabled={reason.trim().length < 3} onPress={() => onArchive(d, reason)} testID={`doc-archive-save-${d.title}`} />
        </View>
      ) : null}
      {d.archived && canManage ? <Button title="Restore" variant="outline" onPress={() => onRestore(d)} testID={`doc-restore-${d.title}`} /> : null}
    </View>
  );
}

// A file attached to a transaction (material request, challan, invoice...): where it came from, open the source, download.
export function AttachmentRow({ a, onOpen, onDownload }: { a: DriveAttachment; onOpen: (a: DriveAttachment) => void; onDownload: (a: DriveAttachment) => void }) {
  return (
    <View style={s.card} testID={`att-${a.name}`}>
      <View style={s.row}>
        <Text style={s.title}>{a.name}</Text>
        <StatusChip label={a.folder} tone="info" />
      </View>
      <Text style={s.muted}>{a.source.label}{a.source.number ? ` ${a.source.number}` : ''} · {formatDateTime(a.uploadedAt)}</Text>
      <View style={s.row}>
        <Button title={`Open ${a.source.label.toLowerCase()}`} variant="outline" onPress={() => onOpen(a)} testID={`att-open-${a.name}`} />
        <Button title="Download" variant="ghost" onPress={() => onDownload(a)} testID={`att-dl-${a.name}`} />
      </View>
    </View>
  );
}
