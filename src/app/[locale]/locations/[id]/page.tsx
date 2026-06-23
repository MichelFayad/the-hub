import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLocationProfile } from "@/services/locations";
import type { Locale } from "@/i18n/direction";

export default async function LocationProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("location");
  const loc = await getLocationProfile(id, locale as Locale);
  if (!loc) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-500">
          {loc.primaryCategory.name}
        </span>
        <h1 className="text-3xl font-bold">{loc.name}</h1>
      </header>

      {loc.media.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {loc.media
            .filter((m) => m.type === "PHOTO")
            .map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.url}
                src={m.url}
                alt={loc.name}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
        </div>
      )}

      {loc.description && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("about")}</h2>
          <p className="text-gray-700">{loc.description}</p>
        </section>
      )}

      {loc.secondaryCategories.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("categories")}</h2>
          <ul className="flex flex-wrap gap-2">
            {loc.secondaryCategories.map((c) => (
              <li
                key={c.slug}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loc.tags.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("tags")}</h2>
          <ul className="flex flex-wrap gap-2">
            {loc.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm"
              >
                {tag}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("contact")}</h2>
        <dl className="flex flex-col gap-1 text-gray-700">
          {loc.phoneNumber && (
            <div className="flex gap-2">
              <dt className="font-medium">{t("phone")}:</dt>
              <dd>
                {loc.phoneNumber}
                {loc.phoneVerified && (
                  <span className="ms-2 text-sm text-green-600">
                    ✓ {t("verified")}
                  </span>
                )}
              </dd>
            </div>
          )}
          {loc.website && (
            <div className="flex gap-2">
              <dt className="font-medium">{t("website")}:</dt>
              <dd>
                <a
                  href={loc.website}
                  className="text-blue-600 underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {loc.website}
                </a>
              </dd>
            </div>
          )}
          {loc.googleMapsUrl && (
            <a
              href={loc.googleMapsUrl}
              className="text-blue-600 underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("viewOnMap")}
            </a>
          )}
        </dl>
      </section>
    </main>
  );
}
