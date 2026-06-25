import { useEffect, useState } from "react";
import { View, Text, ScrollView, Button, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api, ApiError } from "../../src/api/client";
import type { LocationProfile, PublicReview } from "../../src/api/types";

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [location, setLocation] = useState<LocationProfile | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ location: LocationProfile }>(`/api/mobile/locations/${id}`).then((b) => setLocation(b.location));
    api.get<{ reviews: PublicReview[] }>(`/api/mobile/reviews?locationId=${id}`).then((b) => setReviews(b.reviews));
  }, [id]);

  async function addFavorite() {
    try {
      await api.post(`/api/mobile/favorites`, { locationId: id });
      setMessage("Added to favorites");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "failed to add favorite");
    }
  }

  async function submitReview() {
    try {
      await api.post(`/api/mobile/reviews`, { locationId: id, rating: Number(rating), text });
      setText("");
      const body = await api.get<{ reviews: PublicReview[] }>(`/api/mobile/reviews?locationId=${id}`);
      setReviews(body.reviews);
      setMessage("Review submitted");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "failed to submit review");
    }
  }

  if (!location) return <Text style={styles.padded}>Loading…</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{location.name}</Text>
      <Text>{location.primaryCategory.name}</Text>
      {location.description && <Text>{location.description}</Text>}
      <Button title="Add to favorites" onPress={addFavorite} />
      {message && <Text>{message}</Text>}

      <Text style={styles.sectionTitle}>Reviews</Text>
      {reviews.map((r) => (
        <View key={r.id} style={styles.review}>
          <Text style={styles.rowTitle}>
            {r.author.displayName} — {r.rating}★
          </Text>
          {r.text && <Text>{r.text}</Text>}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Leave a review</Text>
      <TextInput
        style={styles.input}
        placeholder="Rating (1-5)"
        keyboardType="numeric"
        value={rating}
        onChangeText={setRating}
      />
      <TextInput style={styles.input} placeholder="Comment" value={text} onChangeText={setText} />
      <Button title="Submit review" onPress={submitReview} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  review: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontWeight: "500" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 8 },
});
