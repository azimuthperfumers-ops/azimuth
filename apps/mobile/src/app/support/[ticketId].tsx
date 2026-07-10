import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { trpc } from "@/lib/trpc";

export default function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const { data: ticket, isLoading } = trpc.ticket.get.useQuery({ ticketId });
  const reply = trpc.ticket.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      utils.ticket.get.invalidate({ ticketId });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
          Loading…
        </Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F0E7]">
        <Text className="text-[10px] font-semibold tracking-[0.28em] text-[#57493A] uppercase">
          Ticket not found
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E7]" edges={["bottom"]}>
      {/* Ticket info strip */}
      <View className="px-5 py-3 border-b border-[#E3DDD1]">
        <Text className="text-[11px] font-semibold tracking-[0.1em] text-[#57493A] uppercase">
          #{ticket.ticketNumber}
        </Text>
        <Text className="text-[14px] font-medium text-[#1B1611] mt-0.5" numberOfLines={1}>
          {ticket.subject}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        data={ticket.messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-[13px] text-[#57493A] text-center">
              No messages yet. Send a message below.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAdmin = item.senderRole === "admin";
          return (
            <View className={`mb-3 max-w-[80%] ${isAdmin ? "self-start" : "self-end"}`}>
              <View
                className="px-4 py-3"
                style={{
                  backgroundColor: isAdmin ? "#EDE3D0" : "#1B1611",
                  borderWidth: isAdmin ? 1 : 0,
                  borderColor: "#E3DDD1",
                }}
              >
                <Text
                  className="text-[13.5px] leading-[1.6]"
                  style={{ color: isAdmin ? "#1B1611" : "#ffffff" }}
                >
                  {item.content}
                </Text>
              </View>
              <Text className="text-[10px] text-[#8A7A63] mt-1 px-1">
                {isAdmin ? "Azimuth · " : ""}
                {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
      />

      {/* Input */}
      {ticket.status !== "resolved" && ticket.status !== "closed" ? (
        <View className="flex-row items-end px-4 py-3 border-t border-[#E3DDD1] gap-3 bg-[#F5F0E7]">
          <TextInput
            className="flex-1 border border-[#E3DDD1] px-4 py-3 text-[14px] text-[#1B1611] max-h-24 bg-white"
            placeholder="Type a message…"
            placeholderTextColor="#8A7A63"
            multiline
            value={message}
            onChangeText={setMessage}
            selectionColor="#9A5B2B"
          />
          <Pressable
            className="h-11 px-5 items-center justify-center bg-[#1B1611] active:opacity-70"
            style={{ opacity: !message.trim() || reply.isPending ? 0.4 : 1 }}
            disabled={!message.trim() || reply.isPending}
            onPress={() => reply.mutate({ ticketId, content: message.trim() })}
          >
            <Text className="text-white text-[10.5px] font-semibold tracking-[0.18em] uppercase">
              {reply.isPending ? "…" : "Send"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="px-5 py-4 border-t border-[#E3DDD1]">
          <Text className="text-[12px] text-[#57493A] text-center tracking-[0.06em]">
            This ticket has been {ticket.status}. Contact us to open a new one.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
