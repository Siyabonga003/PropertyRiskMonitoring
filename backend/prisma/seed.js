"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function seedDatabase() {
    console.log('[Seed] Seeding database with initial demo data...');
    // 1. Create or update Admin User
    const passwordHash = await bcryptjs_1.default.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            name: 'System Administrator',
            role: client_1.Role.ADMIN,
            passwordHash,
        },
        create: {
            email: 'admin@example.com',
            name: 'System Administrator',
            role: client_1.Role.ADMIN,
            passwordHash,
        },
    });
    console.log(`[Seed] Admin user created/verified: ${admin.email}`);
    // 2. Create or verify Property
    let property = await prisma.property.findFirst({
        where: { name: 'Sunset Villa Headquarters' },
    });
    if (!property) {
        property = await prisma.property.create({
            data: {
                name: 'Sunset Villa Headquarters',
                address: '742 Evergreen Terrace, Springfield',
                armingState: client_1.ArmingState.DISARMED,
                users: {
                    connect: { id: admin.id },
                },
            },
        });
    }
    console.log(`[Seed] Property ready: ${property.name} (${property.id})`);
    // 3. Create Zones
    const defaultZones = [
        {
            name: 'Kitchen',
            thresholdConfig: {
                max_temp: 50.0,
                min_temp: 5.0,
                smoke_ppm_critical: 300.0,
                water_leak_enabled: true,
            },
        },
        {
            name: 'Server Room',
            thresholdConfig: {
                max_temp: 35.0,
                min_temp: 10.0,
                smoke_ppm_critical: 150.0,
                water_leak_enabled: true,
            },
        },
        {
            name: 'Basement',
            thresholdConfig: {
                max_temp: 45.0,
                min_temp: 2.0,
                smoke_ppm_critical: 250.0,
                water_leak_enabled: true,
            },
        },
    ];
    const zoneMap = {};
    for (const z of defaultZones) {
        let zone = await prisma.zone.findFirst({
            where: {
                propertyId: property.id,
                name: z.name,
            },
        });
        if (!zone) {
            zone = await prisma.zone.create({
                data: {
                    name: z.name,
                    propertyId: property.id,
                    thresholdConfig: z.thresholdConfig,
                },
            });
        }
        zoneMap[z.name] = zone.id;
        console.log(`[Seed] Zone ready: ${zone.name} (${zone.id})`);
    }
    // 4. Create Demo Device ("ESP32_A1B2C3", token: "tok_esp32_dev_secret_001")
    const primaryZoneId = zoneMap['Kitchen'] || Object.values(zoneMap)[0];
    const device = await prisma.device.upsert({
        where: { id: 'ESP32_A1B2C3' },
        update: {
            name: 'Main Kitchen Multi-Sensor Node',
            zoneId: primaryZoneId,
            deviceToken: 'tok_esp32_dev_secret_001',
            isOnline: true,
            lastSeenAt: new Date(),
            firmwareVer: 'v1.0.0',
        },
        create: {
            id: 'ESP32_A1B2C3',
            name: 'Main Kitchen Multi-Sensor Node',
            zoneId: primaryZoneId,
            deviceToken: 'tok_esp32_dev_secret_001',
            isOnline: true,
            lastSeenAt: new Date(),
            firmwareVer: 'v1.0.0',
        },
    });
    console.log(`[Seed] Demo Device ready: ${device.id} (Zone: Kitchen)`);
    console.log('[Seed] Database seeding completed successfully.');
}
if (require.main === module) {
    seedDatabase()
        .catch((e) => {
        console.error('[Seed] Error seeding database:', e);
        process.exit(1);
    })
        .finally(async () => {
        await prisma.$disconnect();
    });
}
//# sourceMappingURL=seed.js.map