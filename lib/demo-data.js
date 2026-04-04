const now = new Date();

export const demoPayload = {
  mode: "demo",
  generatedAt: now.toISOString(),
  summary: {
    totalEvents: 184,
    animalEvents: 71,
    accidentEvents: 113,
    activeCameras: 4,
    averageConfidence: 0.91,
    latestEventAt: now.toISOString()
  },
  eventMix: [
    { eventType: "Accident", count: 113 },
    { eventType: "Animal Crossing", count: 71 }
  ],
  cameraBreakdown: [
    { cameraId: "CAM-01", count: 56, latestEventAt: new Date(now.getTime() - 1000 * 60 * 12).toISOString() },
    { cameraId: "CAM-02", count: 48, latestEventAt: new Date(now.getTime() - 1000 * 60 * 28).toISOString() },
    { cameraId: "CAM-03", count: 42, latestEventAt: new Date(now.getTime() - 1000 * 60 * 41).toISOString() },
    { cameraId: "CAM-04", count: 38, latestEventAt: new Date(now.getTime() - 1000 * 60 * 65).toISOString() }
  ],
  trend: Array.from({ length: 7 }, (_, index) => ({
    date: new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    count: [14, 19, 24, 17, 31, 36, 43][index]
  })),
  recentEvents: [
    {
      id: 1,
      eventType: "Accident",
      objectType: "2 vehicles (collision proximity)",
      confidence: 0.98,
      confidenceLabel: "High",
      confidencePct: 98,
      occurredAt: new Date(now.getTime() - 1000 * 60 * 9).toISOString(),
      cameraId: "CAM-01",
      zonePath: null,
      imageUrl: null
    },
    {
      id: 2,
      eventType: "Animal Crossing",
      objectType: "Horse",
      confidence: 0.93,
      confidenceLabel: "High",
      confidencePct: 93,
      occurredAt: new Date(now.getTime() - 1000 * 60 * 16).toISOString(),
      cameraId: "CAM-03",
      zonePath: "A -> B -> C",
      imageUrl: null
    },
    {
      id: 3,
      eventType: "Animal Crossing",
      objectType: "Elephant",
      confidence: 0.9,
      confidenceLabel: "High",
      confidencePct: 90,
      occurredAt: new Date(now.getTime() - 1000 * 60 * 33).toISOString(),
      cameraId: "CAM-04",
      zonePath: "C -> B -> A",
      imageUrl: null
    },
    {
      id: 4,
      eventType: "Accident",
      objectType: "1 vehicle(s)",
      confidence: 0.87,
      confidenceLabel: "High",
      confidencePct: 87,
      occurredAt: new Date(now.getTime() - 1000 * 60 * 47).toISOString(),
      cameraId: "CAM-02",
      zonePath: null,
      imageUrl: null
    }
  ]
};
