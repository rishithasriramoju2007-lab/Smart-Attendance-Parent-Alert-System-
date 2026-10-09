import "./globals.css";

export const metadata = {
  title: "Smart Attendance & Parent Alert System",
  description:
    "Period-wise attendance monitoring and parent notification system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}