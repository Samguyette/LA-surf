// Short comment: shared geo helpers to avoid duplicated distance math across modules
export function distanceSquared(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2
  const dLng = lng1 - lng2
  return dLat * dLat + dLng * dLng
}


