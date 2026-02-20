/**
 * useRouteOptimizer -- Optimizes load delivery order to minimize total distance
 *
 * Uses nearest-neighbor TSP approximation with the Haversine formula.
 * Runs entirely client-side -- no API keys, no third-party services.
 *
 * BONUS: Also calculates estimated arrival times based on average speeds.
 */

// --- Types ---------------------------------------------

export interface RoutePoint {
    id: string;
    label: string;
    lat: number;
    lng: number;
    estimatedMinutes?: number;  // time spent at stop
}

export interface OptimizedRoute {
    stops: RouteStop[];
    totalDistanceMiles: number;
    totalDurationMinutes: number;
    savingsVsOriginalMiles: number;
}

export interface RouteStop {
    id: string;
    label: string;
    lat: number;
    lng: number;
    order: number;
    distanceFromPrev: number;          // miles
    cumulativeDistance: number;         // miles
    estimatedArrival: string;          // HH:MM
    estimatedDepartMinutes: number;    // minutes at stop
}

// --- Haversine distance (miles) ------------------------

function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
): number {
    const R = 3959; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
    return deg * Math.PI / 180;
}

// --- Distance matrix ----------------------------------

function buildDistanceMatrix(points: RoutePoint[]): number[][] {
    const n = points.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = haversineDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
            matrix[i][j] = d;
            matrix[j][i] = d;
        }
    }
    return matrix;
}

// --- Nearest-Neighbor TSP -----------------------------

function nearestNeighborTSP(distMatrix: number[][], startIdx: number): number[] {
    const n = distMatrix.length;
    const visited = new Set<number>([startIdx]);
    const route = [startIdx];
    let current = startIdx;

    while (visited.size < n) {
        let nearest = -1;
        let nearestDist = Infinity;
        for (let j = 0; j < n; j++) {
            if (!visited.has(j) && distMatrix[current][j] < nearestDist) {
                nearest = j;
                nearestDist = distMatrix[current][j];
            }
        }
        if (nearest === -1) break;
        visited.add(nearest);
        route.push(nearest);
        current = nearest;
    }
    return route;
}

// --- 2-opt improvement --------------------------------

function twoOptImprove(route: number[], distMatrix: number[][]): number[] {
    const improved = [...route];
    let foundImprovement = true;
    let iterations = 0;
    const maxIterations = 1000;

    while (foundImprovement && iterations < maxIterations) {
        foundImprovement = false;
        iterations++;
        for (let i = 1; i < improved.length - 1; i++) {
            for (let j = i + 1; j < improved.length; j++) {
                const d1 = distMatrix[improved[i - 1]][improved[i]] + distMatrix[improved[j]][improved[(j + 1) % improved.length]];
                const d2 = distMatrix[improved[i - 1]][improved[j]] + distMatrix[improved[i]][improved[(j + 1) % improved.length]];
                if (d2 < d1 - 0.01) {
                    // Reverse the segment between i and j
                    const segment = improved.slice(i, j + 1).reverse();
                    improved.splice(i, segment.length, ...segment);
                    foundImprovement = true;
                }
            }
        }
    }
    return improved;
}

// --- Total route distance -----------------------------

function routeDistance(route: number[], distMatrix: number[][]): number {
    let total = 0;
    for (let i = 1; i < route.length; i++) {
        total += distMatrix[route[i - 1]][route[i]];
    }
    return total;
}

// --- Main optimizer function --------------------------

export function optimizeRoute(
    points: RoutePoint[],
    options?: {
        startIndex?: number;
        startTime?: string;          // HH:MM -- shift start
        avgSpeedMph?: number;        // default: 30 (urban)
        minutesPerStop?: number;     // default: 10
    },
): OptimizedRoute {
    if (points.length === 0) {
        return { stops: [], totalDistanceMiles: 0, totalDurationMinutes: 0, savingsVsOriginalMiles: 0 };
    }

    if (points.length === 1) {
        return {
            stops: [{
                ...points[0], order: 1, distanceFromPrev: 0, cumulativeDistance: 0,
                estimatedArrival: options?.startTime ?? "08:00", estimatedDepartMinutes: options?.minutesPerStop ?? 10,
            }],
            totalDistanceMiles: 0,
            totalDurationMinutes: options?.minutesPerStop ?? 10,
            savingsVsOriginalMiles: 0,
        };
    }

    const startIdx = options?.startIndex ?? 0;
    const avgSpeed = options?.avgSpeedMph ?? 30;
    const minutesPerStop = options?.minutesPerStop ?? 10;
    const startTimeParts = (options?.startTime ?? "08:00").split(":").map(Number);
    let currentMinutes = startTimeParts[0] * 60 + startTimeParts[1];

    // Build distance matrix
    const distMatrix = buildDistanceMatrix(points);

    // Original route distance (as given)
    const originalOrder = points.map((_, i) => i);
    const originalDist = routeDistance(originalOrder, distMatrix);

    // Optimize: nearest-neighbor + 2-opt improvement
    let optimizedOrder = nearestNeighborTSP(distMatrix, startIdx);
    optimizedOrder = twoOptImprove(optimizedOrder, distMatrix);

    const optimizedDist = routeDistance(optimizedOrder, distMatrix);

    // Build stop list with ETAs
    const stops: RouteStop[] = [];
    let cumDist = 0;

    for (let i = 0; i < optimizedOrder.length; i++) {
        const idx = optimizedOrder[i];
        const point = points[idx];
        const distFromPrev = i === 0 ? 0 : distMatrix[optimizedOrder[i - 1]][idx];
        cumDist += distFromPrev;

        // Calculate travel time
        const travelMinutes = distFromPrev > 0 ? (distFromPrev / avgSpeed) * 60 : 0;
        currentMinutes += travelMinutes;

        const hours = Math.floor(currentMinutes / 60) % 24;
        const mins = Math.floor(currentMinutes % 60);
        const eta = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

        stops.push({
            id: point.id,
            label: point.label,
            lat: point.lat,
            lng: point.lng,
            order: i + 1,
            distanceFromPrev: Math.round(distFromPrev * 10) / 10,
            cumulativeDistance: Math.round(cumDist * 10) / 10,
            estimatedArrival: eta,
            estimatedDepartMinutes: point.estimatedMinutes ?? minutesPerStop,
        });

        // Add stop time
        currentMinutes += point.estimatedMinutes ?? minutesPerStop;
    }

    const totalDuration = currentMinutes - (startTimeParts[0] * 60 + startTimeParts[1]);

    return {
        stops,
        totalDistanceMiles: Math.round(optimizedDist * 10) / 10,
        totalDurationMinutes: Math.round(totalDuration),
        savingsVsOriginalMiles: Math.round((originalDist - optimizedDist) * 10) / 10,
    };
}

// --- Geocoding helper (free, approximate) -------------
// Uses Nominatim (OpenStreetMap) -- free, no API key needed
// Rate limited to 1 req/sec -- use sparingly

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const encoded = encodeURIComponent(address);
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
            { headers: { "User-Agent": "AnikaLogisticsCRM/1.0" } },
        );
        const data = await resp.json();
        if (data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
        return null;
    } catch {
        return null;
    }
}

export default optimizeRoute;
