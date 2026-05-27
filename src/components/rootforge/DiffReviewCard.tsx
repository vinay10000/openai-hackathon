import { Pressable, Text, View } from 'react-native';

import { ReviewedOperation } from '../../features/rootforge/types';
import { RootForgeStyles } from '../../styles/rootForgeStyles';

type DiffReviewCardProps = {
  operation: ReviewedOperation;
  onDecision: (id: string, accepted: boolean) => void;
  styles: RootForgeStyles;
};

export function DiffReviewCard({ operation, onDecision, styles }: DiffReviewCardProps) {
  return (
    <View style={styles.actionCard}>
      <View style={styles.rowBetween}>
        <View style={styles.diffHeaderCopy}>
          <Text style={styles.actionTitle}>{operation.path}</Text>
          <Text style={styles.muted}>
            {operation.type === 'delete_path' ? 'Delete' : operation.beforeContent ? 'Modify' : 'Create'}
          </Text>
        </View>
        <Text style={[styles.pathBadge, operation.accepted ? styles.acceptedBadge : styles.rejectedBadge]}>
          {operation.accepted ? 'accepted' : 'rejected'}
        </Text>
      </View>
      <Text style={styles.muted}>{operation.rationale}</Text>
      <View style={styles.diffContainer}>
        {operation.diffLines.map((line, index) => (
          <View
            key={`${operation.id}:${index}`}
            style={[
              styles.diffLine,
              line.kind === 'added'
                ? styles.diffLineAdded
                : line.kind === 'removed'
                  ? styles.diffLineRemoved
                  : undefined,
            ]}
          >
            <Text style={styles.diffPrefix}>{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</Text>
            <Text style={styles.diffText}>{line.value || ' '}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actionButtons}>
        <Pressable style={[styles.smallButton, styles.denyButton]} onPress={() => onDecision(operation.id, false)}>
          <Text style={styles.denyText}>Reject file</Text>
        </Pressable>
        <Pressable style={[styles.smallButton, styles.allowButton]} onPress={() => onDecision(operation.id, true)}>
          <Text style={styles.allowText}>Accept file</Text>
        </Pressable>
      </View>
    </View>
  );
}
