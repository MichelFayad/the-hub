import { View, Text, Button, StyleSheet } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{user?.displayName}</Text>
      <Text>{user?.email}</Text>
      <Button title="Log out" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "600" },
});
