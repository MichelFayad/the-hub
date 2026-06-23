import { useTranslations } from "next-intl";

export default function Landing() {
  const t = useTranslations("landing");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-lg text-gray-600">{t("tagline")}</p>
    </main>
  );
}
