import { Pressable, Text, TextInput, View } from "react-native";

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

export function validateAddressForm(form: AddressForm) {
  const errs: Partial<Record<keyof AddressForm, string>> = {};
  if (!form.fullName.trim()) errs.fullName = "Required";
  if (!form.phone.trim()) errs.phone = "Required";
  else if (!/^\d{10}$/.test(form.phone.replace(/[\s-]/g, ""))) errs.phone = "Enter a valid 10-digit number";
  if (!form.line1.trim()) errs.line1 = "Required";
  if (!form.city.trim()) errs.city = "Required";
  if (!form.state.trim()) errs.state = "Required";
  if (!form.pincode.trim()) errs.pincode = "Required";
  else if (!/^\d{6}$/.test(form.pincode)) errs.pincode = "Enter a valid 6-digit pincode";
  return errs;
}

function Field({
  label, value, onChangeText, error, keyboardType, maxLength, hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  maxLength?: number;
  hint?: string;
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
        className="border-b-2 text-[15px] pb-2"
        style={{ borderColor: error ? Colors.accent : Colors.ink, color: Colors.ink }}
        placeholderTextColor="#8A7A63"
        selectionColor={Colors.accent}
      />
      {error && <Text className="mt-1 text-[11px]" style={{ color: Colors.accent }}>{error}</Text>}
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

      <Field label="Full name" value={form.fullName} onChangeText={(v) => onChange("fullName", v)} error={errors.fullName} />
      <Field label="Phone" value={form.phone} onChangeText={(v) => onChange("phone", v)} error={errors.phone} keyboardType="phone-pad" maxLength={10} hint="10-digit mobile" />
      <Field label="Address line 1" value={form.line1} onChangeText={(v) => onChange("line1", v)} error={errors.line1} />
      <Field label="Address line 2 (optional)" value={form.line2} onChangeText={(v) => onChange("line2", v)} />
      <Field label="City" value={form.city} onChangeText={(v) => onChange("city", v)} error={errors.city} />
      <Field label="State" value={form.state} onChangeText={(v) => onChange("state", v)} error={errors.state} />
      <Field label="Pincode" value={form.pincode} onChangeText={(v) => onChange("pincode", v)} error={errors.pincode} keyboardType="number-pad" maxLength={6} />
    </View>
  );
}
