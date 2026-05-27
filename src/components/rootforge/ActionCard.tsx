import { Pressable, Text, View } from 'react-native';

import { AgentAction } from '../../features/rootforge/types';
import { RootForgeStyles } from '../../styles/rootForgeStyles';

type ActionCardProps = {
  action: AgentAction;
  onDecision: (id: string, status: AgentAction['status']) => void;
  styles: RootForgeStyles;
};

export function ActionCard({ action, onDecision, styles }: ActionCardProps) {
  const riskStyle =
    action.risk === 'high' ? styles.riskHigh : action.risk === 'medium' ? styles.riskMedium : styles.riskLow;

  return (
    <View style={styles.actionCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.actionTitle}>{action.label}</Text>
        <View style={styles.actionMeta}>
          <Text style={styles.actionStatus}>{action.status}</Text>
          <Text style={[styles.risk, riskStyle]}>{action.risk}</Text>
        </View>
      </View>
      <Text style={styles.muted}>{action.details}</Text>
      {action.status === 'done' ? null : (
        <View style={styles.actionButtons}>
          <Pressable style={[styles.smallButton, styles.denyButton]} onPress={() => onDecision(action.id, 'denied')}>
            <Text style={styles.denyText}>Deny</Text>
          </Pressable>
          <Pressable style={[styles.smallButton, styles.allowButton]} onPress={() => onDecision(action.id, 'approved')}>
            <Text style={styles.allowText}>Allow</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
