import { ImageResponse } from "next/og";

export const alt = "The Gluten-Free Beer Index: a field guide with test results for every beer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbf8f1", color: "#181512", padding: 70, border: "14px solid #181512" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#c26d1a" }}>Field Guide · Vol. 1</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, lineHeight: 1 }}>The Gluten-Free</div>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, lineHeight: 1, color: "#c26d1a" }}>Beer Index</div>
          <div style={{ display: "flex", fontSize: 34, marginTop: 28, color: "#6b6254" }}>Four kinds of beer, sorted honestly, with the test receipts.</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, textTransform: "uppercase", letterSpacing: 3 }}>
          <span style={{ display: "flex", background: "#2d5a27", color: "#fbf8f1", padding: "8px 16px" }}>100% NGCI</span>
          <span style={{ display: "flex", background: "#e5a93c", padding: "8px 16px" }}>Crafted to remove</span>
          <span style={{ display: "flex", border: "2px solid #c26d1a", color: "#c26d1a", padding: "6px 16px" }}>Naturally low ppm</span>
          <span style={{ display: "flex", border: "2px dashed #6b6254", color: "#6b6254", padding: "6px 16px" }}>Standard</span>
        </div>
      </div>
    ),
    size,
  );
}
