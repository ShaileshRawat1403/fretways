import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LabelMode, NeckCell } from "./neck";

const roleColor = {
  root: "#e2b657",
  third: "#7eb8a2",
  fifth: "#8aa4c8",
} as const;

export function NeckBoard(props: {
  frets: number[];
  rows: NeckCell[][];
  stringLabels: string[];
  labelMode: LabelMode;
  selectedKey: string | null;
  onTap: (cell: NeckCell) => void;
}) {
  return (
    <View style={styles.board}>
      <View style={styles.numberRow}>
        <View style={styles.stringGutter} />
        {props.frets.map((fret) => (
          <Text key={fret} style={styles.fretNumber}>
            {fret === 0 ? "open" : fret}
          </Text>
        ))}
      </View>
      {props.rows.map((row, rowIndex) => (
        <View key={props.stringLabels[rowIndex]} style={styles.stringRow}>
          <Text style={styles.stringLabel}>{props.stringLabels[rowIndex]}</Text>
          {row.map((cell) => {
            const key = `${cell.stringIndex}-${cell.fret}`;
            const selected = props.selectedKey === key;
            const marker = cell.role ? roleColor[cell.role] : null;
            const caption =
              props.labelMode === "names" ? cell.noteName.replace(/[0-9-]/g, "") : props.labelMode === "intervals" ? cell.intervalLabel : "";
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`String ${cell.conventionalString}, fret ${cell.fret}, ${cell.noteName}`}
                onPress={() => props.onTap(cell)}
                style={[styles.cell, selected && styles.selected]}
              >
                <View style={styles.stringLine} />
                {marker ? <View style={[styles.marker, { backgroundColor: marker }]} /> : null}
                {caption ? (
                  <Text style={[styles.caption, marker ? styles.captionOnMarker : styles.quiet]}>{caption}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: "#2a2420",
    borderRadius: 18,
    paddingVertical: 8,
    paddingRight: 8,
  },
  numberRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  stringGutter: { width: 36 },
  fretNumber: { flex: 1, textAlign: "center", color: "#c4b8a5", fontSize: 12 },
  stringRow: { flexDirection: "row", alignItems: "center" },
  stringLabel: { width: 36, textAlign: "center", color: "#f3efe6", fontSize: 16, fontWeight: "600" },
  cell: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 2,
    borderLeftColor: "#8d8376",
  },
  selected: { backgroundColor: "#3a332c" },
  stringLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#d9c7a2",
    opacity: 0.55,
  },
  marker: { width: 28, height: 28, borderRadius: 14 },
  caption: { fontSize: 11, fontWeight: "700", zIndex: 1 },
  captionOnMarker: { position: "absolute", color: "#1c1915" },
  quiet: { color: "#b7ad9f", fontWeight: "500" },
});
