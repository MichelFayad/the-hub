-- Natural dedup key for admin bulk import (scope §5.1).
CREATE UNIQUE INDEX "Location_googleMapsUrl_key" ON "Location"("googleMapsUrl");
