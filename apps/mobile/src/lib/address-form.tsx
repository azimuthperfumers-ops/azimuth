import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";

import {
  INDIAN_STATES,
  normalizeAddress,
  normalizeState,
  sanitizeAddressLine,
  sanitizeCity,
  sanitizeName,
  sanitizePhone,
  sanitizePincode,
  validateAddress,
} from "@azimuth/api/address";

import { Colors } from "@/constants/theme";

export type AddressForm = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export const EMPTY_ADDRESS_FORM: AddressForm = {
  label: "Home", fullName: "", phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "", isDefault: false,
};

export const ADDRESS_LABELS = ["Home", "Work", "Other"];

/**
 * Validation and normalisation are shared with the web app and the API — see
 * packages/api/src/lib/address-validation.ts. Shiprocket rejects a booking whose
 * phone carries a "+91" or a space, so the form never lets one be typed.
 */
export function validateAddressForm(form: AddressForm) {
  return validateAddress(form) as Partial<Record<keyof AddressForm, string>>;
}

/** The canonical form of the address — what gets saved and ordered. */
export function normalizeAddressForm(form: AddressForm): AddressForm {
  const normalized = normalizeAddress(form);
  return { ...form, ...normalized, line2: normalized.line2 ?? "" };
}

/** Cleans one field as it is typed; unknown keys pass through. */
export function sanitizeAddressValue<K extends keyof AddressForm>(key: K, value: AddressForm[K]): AddressForm[K] {
  if (typeof value !== "string") return value;
  const clean = (() => {
    switch (key) {
      case "phone": return sanitizePhone(value);
      case "pincode": return sanitizePincode(value);
      case "fullName": return sanitizeName(value);
      case "city": return sanitizeCity(value);
      case "line1":
      case "line2": return sanitizeAddressLine(value);
      default: return value;
    }
  })();
  return clean as AddressForm[K];
}

function Field({
  label, value, onChangeText, error, keyboardType, maxLength, hint, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  maxLength?: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <View className="mb-4">
      <View className="flex-row items-baseline justify-between mb-1.5">
        <Text className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: Colors.inkMuted }}>
          {label}
        </Text>
        {hint && !error && (
          <Text className="text-[9.5px]" style={{ color: "#8A7A63" }}>{hint}</Text>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholder={placeholder}
        className="border-b-2 text-[15px] pb-2"
        style={{ borderColor: error ? Colors.accent : Colors.ink, color: Colors.ink }}
        placeholderTextColor="#8A7A63"
        selectionColor={Colors.accent}
      />
      {error && <Text className="mt-1 text-[11px]" style={{ color: Colors.accent }}>{error}</Text>}
    </View>
  );
}

/**
 * State is chosen from a list rather than typed — a misspelt state is one of the
 * ways a booking fails at the courier, and it can't be fixed by the customer
 * once the order is paid for.
 */
function StatePicker({
  value, onSelect, error,
}: {
  value: string;
  onSelect: (state: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => normalizeState(value), [value]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? INDIAN_STATES.filter((s) => s.toLowerCase().includes(q)) : INDIAN_STATES;
  }, [query]);

  return (
    <View className="mb-4">
      <Text className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: Colors.inkMuted }}>
        State
      </Text>
      <Pressable
        onPress={() => { setQuery(""); setOpen(true); }}
        className="border-b-2 pb-2 flex-row items-center justify-between"
        style={{ borderColor: error ? Colors.accent : Colors.ink }}
      >
        <Text className="text-[15px]" style={{ color: selected ? Colors.ink : "#8A7A63" }}>
          {selected ?? "Select state"}
        </Text>
        <Text className="text-[12px]" style={{ color: Colors.inkMuted }}>▾</Text>
      </Pressable>
      {error && <Text className="mt-1 text-[11px]" style={{ color: Colors.accent }}>{error}</Text>}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 px-5 pt-16" style={{ backgroundColor: Colors.background }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[13px] font-semibold tracking-[0.14em] uppercase" style={{ color: Colors.ink }}>
              Select state
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text className="text-[13px]" style={{ color: Colors.inkMuted }}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            autoFocus
            className="border-b-2 text-[15px] pb-2 mb-2"
            style={{ borderColor: Colors.ink, color: Colors.ink }}
            placeholderTextColor="#8A7A63"
            selectionColor={Colors.accent}
          />
          <FlatList
            data={matches}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item); setOpen(false); }}
                className="py-3.5 border-b"
                style={{ borderColor: Colors.border }}
              >
                <Text className="text-[15px]" style={{ color: item === selected ? Colors.accent : Colors.ink }}>
                  {item}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className="py-6 text-[13px]" style={{ color: Colors.inkMuted }}>No matching state</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

export function AddressFormFields({
  form, onChange, errors,
}: {
  form: AddressForm;
  onChange: <K extends keyof AddressForm>(key: K, value: AddressForm[K]) => void;
  errors: Partial<Record<keyof AddressForm, string>>;
}) {
  // Every text field is cleaned on the way in, so the form's state is always the
  // value that will be sent — no trimming or stripping at submit time.
  const set = <K extends keyof AddressForm>(key: K) => (value: AddressForm[K]) =>
    onChange(key, sanitizeAddressValue(key, value));

  return (
    <View>
      <View className="flex-row gap-2 mb-4">
        {ADDRESS_LABELS.map((l) => {
          const active = form.label === l;
          return (
            <Pressable
              key={l}
              onPress={() => onChange("label", l)}
              className="flex-1 h-10 items-center justify-center border"
              style={{ borderColor: active ? Colors.ink : Colors.border, backgroundColor: active ? Colors.ink : "transparent" }}
            >
              <Text
                className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: active ? "#fff" : Colors.inkMuted }}
              >
                {l}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Full name" value={form.fullName} onChangeText={set("fullName")} error={errors.fullName} />
      <Field
        label="Phone"
        value={form.phone}
        onChangeText={set("phone")}
        error={errors.phone}
        keyboardType="number-pad"
        maxLength={10}
        hint="10-digit mobile"
        placeholder="9876543210"
      />
      <Field label="Address line 1" value={form.line1} onChangeText={set("line1")} error={errors.line1} />
      <Field label="Address line 2 (optional)" value={form.line2} onChangeText={set("line2")} />
      <Field label="City" value={form.city} onChangeText={set("city")} error={errors.city} />
      <StatePicker value={form.state} onSelect={(s) => onChange("state", s)} error={errors.state} />
      <Field
        label="Pincode"
        value={form.pincode}
        onChangeText={set("pincode")}
        error={errors.pincode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="560001"
      />
    </View>
  );
}
