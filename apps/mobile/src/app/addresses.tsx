import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";

import { trpc } from "@/lib/trpc";
import { Colors } from "@/constants/theme";
import {
  type AddressForm,
  AddressFormFields,
  EMPTY_ADDRESS_FORM,
  validateAddressForm,
} from "@/lib/address-form";

function AddAddressForm({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<AddressForm>({ ...EMPTY_ADDRESS_FORM });
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  const add = trpc.userData.addAddress.useMutation({
    onSuccess: async () => {
      await utils.userData.listAddresses.invalidate();
      onDone();
    },
    onError: (err) => Alert.alert("Couldn't save address", err.message),
  });

  function change<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function submit() {
    const errs = validateAddressForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    add.mutate({
      label: form.label,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      isDefault: form.isDefault,
      lat: form.lat,
      lng: form.lng,
    });
  }

  return (
    <View className="p-5 border" style={{ borderColor: Colors.border }}>
      <Text className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-4" style={{ color: Colors.inkMuted }}>
        New address
      </Text>
      <AddressFormFields
        form={form}
        errors={errors}
        onChange={change}
        onLocated={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
      />
      <Pressable
        onPress={() => change("isDefault", !form.isDefault)}
        className="flex-row items-center gap-2.5 mb-5"
      >
        <View
          className="w-4 h-4 items-center justify-center"
          style={{ borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: form.isDefault ? Colors.ink : "transparent" }}
        >
          {form.isDefault && <View className="w-2 h-2 bg-white" />}
        </View>
        <Text className="text-[12.5px]" style={{ color: Colors.inkMuted }}>Set as default address</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <Pressable
          onPress={submit}
          disabled={add.isPending}
          className="flex-1 h-12 items-center justify-center bg-[#111111] active:opacity-70"
          style={{ opacity: add.isPending ? 0.6 : 1 }}
        >
          <Text className="text-white text-[10.5px] font-semibold tracking-[0.2em] uppercase">
            {add.isPending ? "Saving…" : "Save address"}
          </Text>
        </Pressable>
        <Pressable onPress={onDone} className="h-12 px-6 items-center justify-center border" style={{ borderColor: Colors.border }}>
          <Text className="text-[10.5px] font-semibold tracking-[0.2em] uppercase" style={{ color: Colors.inkMuted }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  lat?: number | null;
  lng?: number | null;
};

function EditAddressForm({ address, onDone }: { address: Address; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<AddressForm>({
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    isDefault: address.isDefault,
    lat: address.lat ?? undefined,
    lng: address.lng ?? undefined,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  const update = trpc.userData.updateAddress.useMutation({
    onSuccess: async () => {
      await utils.userData.listAddresses.invalidate();
      onDone();
    },
    onError: (err) => Alert.alert("Couldn't save changes", err.message),
  });

  function change<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function submit() {
    const errs = validateAddressForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    update.mutate({
      id: address.id,
      label: form.label,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      lat: form.lat,
      lng: form.lng,
    });
  }

  return (
    <View className="p-5 border" style={{ borderColor: Colors.ink }}>
      <Text className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-4" style={{ color: Colors.inkMuted }}>
        Edit address
      </Text>
      <AddressFormFields
        form={form}
        errors={errors}
        onChange={change}
        onLocated={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
      />
      <View className="flex-row gap-3">
        <Pressable
          onPress={submit}
          disabled={update.isPending}
          className="flex-1 h-12 items-center justify-center bg-[#111111] active:opacity-70"
          style={{ opacity: update.isPending ? 0.6 : 1 }}
        >
          <Text className="text-white text-[10.5px] font-semibold tracking-[0.2em] uppercase">
            {update.isPending ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>
        <Pressable onPress={onDone} className="h-12 px-6 items-center justify-center border" style={{ borderColor: Colors.border }}>
          <Text className="text-[10.5px] font-semibold tracking-[0.2em] uppercase" style={{ color: Colors.inkMuted }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddressCard({ address, onSetDefault, onDelete, onEdit }: {
  address: Address;
  onSetDefault: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <View
      className="p-4 border mb-3"
      style={{ borderColor: address.isDefault ? Colors.ink : Colors.border, position: "relative" }}
    >
      {address.isDefault && (
        <Text
          className="absolute right-3 top-3 text-[9px] font-semibold tracking-[0.14em] uppercase"
          style={{ color: Colors.inkMuted }}
        >
          Default
        </Text>
      )}
      <Text className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1" style={{ color: Colors.inkMuted }}>
        {address.label}
      </Text>
      <Text className="text-[14px] font-semibold" style={{ color: Colors.ink }}>{address.fullName}</Text>
      <Text className="text-[12.5px] mt-1 leading-relaxed" style={{ color: Colors.inkMuted }}>
        {address.line1}{address.line2 ? `, ${address.line2}` : ""}{"\n"}
        {address.city}, {address.state} — {address.pincode}{"\n"}
        {address.phone}
      </Text>
      <View className="flex-row gap-5 mt-3">
        <Pressable onPress={onEdit}>
          <Text className="text-[11px] font-semibold underline" style={{ color: Colors.inkMuted }}>Edit</Text>
        </Pressable>
        {!address.isDefault && (
          <Pressable onPress={onSetDefault}>
            <Text className="text-[11px] font-semibold underline" style={{ color: Colors.inkMuted }}>Set as default</Text>
          </Pressable>
        )}
        <Pressable onPress={onDelete}>
          <Text className="text-[11px] font-semibold underline" style={{ color: Colors.accent }}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AddressesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: addresses = [], isLoading } = trpc.userData.listAddresses.useQuery();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteAddr = trpc.userData.deleteAddress.useMutation({
    onSuccess: () => utils.userData.listAddresses.invalidate(),
  });
  const setDefault = trpc.userData.setDefaultAddress.useMutation({
    onSuccess: () => utils.userData.listAddresses.invalidate(),
  });

  function confirmDelete(id: string) {
    Alert.alert("Remove address", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteAddr.mutate({ id }) },
    ]);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: Colors.background }} edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-center px-5 py-3.5 relative border-b" style={{ borderColor: Colors.border }}>
        <Pressable onPress={() => router.back()} className="absolute left-5 p-1">
          <ChevronLeft size={20} color={Colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text className="text-[15px] tracking-[0.16em] font-semibold uppercase" style={{ color: Colors.ink }}>
          Addresses
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {isLoading ? (
          <Text className="text-[10px] font-semibold tracking-[0.28em] uppercase" style={{ color: Colors.inkMuted }}>
            Loading…
          </Text>
        ) : (
          <>
            {addresses.length === 0 && !adding && (
              <Text className="text-[13px] mb-4" style={{ color: Colors.inkMuted }}>
                No saved addresses yet — add one for faster checkout.
              </Text>
            )}

            {addresses.map((addr) =>
              editingId === addr.id ? (
                <EditAddressForm key={addr.id} address={addr} onDone={() => setEditingId(null)} />
              ) : (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  onEdit={() => setEditingId(addr.id)}
                  onSetDefault={() => setDefault.mutate({ id: addr.id })}
                  onDelete={() => confirmDelete(addr.id)}
                />
              ),
            )}

            {adding ? (
              <AddAddressForm onDone={() => setAdding(false)} />
            ) : (
              <Pressable
                onPress={() => setAdding(true)}
                className="flex-row items-center justify-center gap-2 h-14 border border-dashed active:opacity-70"
                style={{ borderColor: Colors.border }}
              >
                <Plus size={14} color={Colors.inkMuted} strokeWidth={1.6} />
                <Text className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: Colors.inkMuted }}>
                  {addresses.length === 0 ? "Add delivery address" : "Add another address"}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
