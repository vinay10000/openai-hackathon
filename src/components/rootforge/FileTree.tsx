import { Pressable, Text, View } from 'react-native';

import { WorkspaceNode } from '../../services/workspace';
import { RootForgeStyles } from '../../styles/rootForgeStyles';
import { spacing } from '../../theme/tokens';

type FileTreeProps = {
  nodes: WorkspaceNode[];
  selectedPath: string;
  onSelect: (node: WorkspaceNode) => void;
  styles: RootForgeStyles;
  level?: number;
};

export function FileTree({ nodes, selectedPath, onSelect, styles, level = 0 }: FileTreeProps) {
  return (
    <View style={styles.treeGroup}>
      {nodes.map((node) => {
        const isSelected = node.path === selectedPath;
        return (
          <View key={node.id}>
            <Pressable
              style={[
                styles.fileRow,
                { paddingLeft: spacing.sm + level * spacing.lg },
                isSelected && styles.fileRowSelected,
              ]}
              onPress={() => onSelect(node)}
            >
              <Text style={styles.fileIcon}>{node.type === 'folder' ? '▸' : '•'}</Text>
              <Text style={styles.fileName}>{node.name}</Text>
              <Text style={styles.fileType}>{node.type}</Text>
            </Pressable>
            {node.children ? (
              <FileTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} styles={styles} level={level + 1} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
