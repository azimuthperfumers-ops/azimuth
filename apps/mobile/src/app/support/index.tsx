import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { trpc } from "@/lib/trpc";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLOR: Record<string, string> = {
  open: "#c0392b",
  in_progress: "#111111",
  resolved: "#2d6a4f",
  closed: "#888888",
};

export default function SupportScreen() {
  const router = useRouter();
  const { data = [], isLoading } = trpc.ticket.list.useQuery();

  return (
    <SafeAreaView className="flex-1 bg-[#faf8f5]" edges={["bottom"]}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#888888] uppercase">
            Loading…
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(t) => t.id}
          ItemSeparatorComponent={() => <View className="h-px bg-[#e8e2da]" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="py-24 items-center px-8">
              <Text
                className="text-[26px] font-medium text-[#111111] text-center mb-3"
                style={{ fontStyle: "italic" }}
              >
                All good here
              </Text>
              <Text className="text-[14px] text-[#888888] text-center leading-relaxed">
                No support tickets yet. Raise one from your order page if you need help.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              className="px-6 py-5 active:bg-[#f0ede8]"
              onPress={() => router.push(`/support/${item.id}`)}
            >
              <View className="flex-row items-start justify-between gap-3 mb-1.5">
                <Text
                  className="text-[15px] font-medium text-[#111111] flex-1 leading-snug"
                  numberOfLines={2}
                >
                  {item.subject}
                </Text>
                <View
                  className="px-2.5 py-1 mt-0.5"
                  style={{
                    borderWidth: 1,
                    borderColor: STATUS_COLOR[item.status] ?? "#888888",
                  }}
                >
                  <Text
                    className="text-[8.5px] font-semibold tracking-[0.16em] uppercase"
                    style={{ color: STATUS_COLOR[item.status] ?? "#888888" }}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] tracking-[0.12em] text-[#888888]">
                #{item.ticketNumber}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
