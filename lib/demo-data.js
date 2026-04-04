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
  ],
  cameraSources: [
    {
      id: 1,
      cameraId: "CAM-01",
      sourceType: "rtsp",
      sourceValue: "rtsp://road-east/live",
      locationLabel: "East approach",
      gpsLat: 11.1436,
      gpsLon: 76.9235,
      zoneLabel: "North shoulder crossing",
      status: "active",
      updatedAt: now.toISOString()
    },
    {
      id: 2,
      cameraId: "CAM-02",
      sourceType: "video-file",
      sourceValue: "videos/road-demo.mp4",
      locationLabel: "South approach",
      gpsLat: 11.1451,
      gpsLon: 76.9278,
      zoneLabel: "Median approach",
      status: "standby",
      updatedAt: new Date(now.getTime() - 1000 * 60 * 20).toISOString()
    }
  ],
  notificationSettings: {
    smsEnabled: true,
    animalRecipients: ["+15551230001"],
    accidentRecipients: ["+15551230002", "+15551230003"],
    cooldownSeconds: 60,
    testRecipient: "+15551230001",
    hasTwilioConfig: false,
    fromNumberMasked: null
  },
  assetRegistry: [
    {
      id: 1,
      assetKind: "trained-model",
      title: "Animal species classifier",
      filename: "best.pt",
      storageMode: "inline",
      fileSize: 7340032,
      classLabels: ["cat", "dog", "elephant", "horse", "lion"],
      notes: "Latest production classifier for species refinement.",
      externalUrl: null,
      isActive: true,
      status: "ready",
      createdAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      downloadUrl: "/api/assets/1"
    },
    {
      id: 2,
      assetKind: "dataset",
      title: "Field dataset v2",
      filename: "wildlife-dataset.zip",
      storageMode: "external-url",
      fileSize: 0,
      classLabels: ["dog", "deer", "cow", "elephant", "horse", "monkey"],
      notes: "Curated dataset archive for retraining and review.",
      externalUrl: "https://example.com/datasets/wildlife-dataset.zip",
      isActive: false,
      status: "registered",
      createdAt: new Date(now.getTime() - 1000 * 60 * 240).toISOString(),
      downloadUrl: "https://example.com/datasets/wildlife-dataset.zip"
    }
  ]
};
