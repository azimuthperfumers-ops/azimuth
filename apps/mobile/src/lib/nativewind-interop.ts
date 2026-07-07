import { cssInterop } from "nativewind";
import { Image } from "expo-image";

// NativeWind only auto-registers className support for react-native's own
// core components (View, Text, react-native's Image, etc). expo-image's
// Image is a separate native component NativeWind doesn't know about, so
// without this, className is silently dropped — the image renders at 0 size
// and only the parent View's background color shows.
// https://www.nativewind.dev/api/css-interop
cssInterop(Image, { className: "style" });
