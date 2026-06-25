import { useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";
import type { SearchResult } from "../../src/api/types";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSearch() {
    setError(null);
    try {
      const body = await api.get<{ results: SearchResult[] }>(
        `/api/mobile/locations/search?query=${encodeURIComponent(query)}`,
      );
      setResults(body.results);
    } catch {
      setError("search failed");
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search locations"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={onSearch}
        returnKeyType="search"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/location/${item.id}`)}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text>{item.ratingAvg ? `★ ${item.ratingAvg.toFixed(1)}` : "No ratings yet"}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "500" },
});
