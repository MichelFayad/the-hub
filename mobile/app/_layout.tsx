import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

function RootNavigator() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="location/[id]" options={{ headerShown: true, title: "Location" }} />
        </>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
