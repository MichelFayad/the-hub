import { useCallback, useState } from "react";
import { View, FlatList, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../src/api/client";
import type { Favorite } from "../../src/api/types";

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ favorites: Favorite[] }>("/api/mobile/favorites")
        .then((body) => setFavorites(body.favorites))
        .catch(() => setFavorites([]));
    }, []),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/location/${item.locationId}`)}>
            <Text style={styles.rowTitle}>{item.location.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>No favorites yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "500" },
});
