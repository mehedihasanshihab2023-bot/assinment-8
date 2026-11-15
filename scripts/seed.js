/**
 * Seeds StudioSpace with demo hosts, studios, bookings and reviews.
 *
 *   npm run seed          -> adds demo data, keeps existing listings
 *   npm run seed:reset    -> wipes studios/bookings/reviews/wishlists first
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDB, ensureIndexes } from "../src/db.js";

const reset = process.argv.includes("--reset");
const img = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

const USERS = [
  {
    name: "Maya Rahman",
    email: "host@studiospace.com",
    password: "Host1234",
    photoURL:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Araf Chowdhury",
    email: "creator@studiospace.com",
    password: "Creator123",
    photoURL:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
  },
  {
    name: "Noah Kim",
    email: "studio@studiospace.com",
    password: "Studio123",
    photoURL:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
  },
];

const STUDIOS = [
  {
    title: "Northlight Cyc Wall Studio",
    category: "Photo Studio",
    hourlyRate: 65,
    securityDeposit: 150,
    capacity: 18,
    location: "Banani, Dhaka",
    image: img("photo-1516035069371-29a1b244cc32"),
    gallery: [
      img("photo-1516035069371-29a1b244cc32"),
      img("photo-1524368535928-5b5e00ddc76b"),
      img("photo-1598488035139-bdbb2231ce04"),
    ],
    amenities: ["Infinity cyc wall", "Profoto strobes", "C-stands", "Makeup room", "Wi-Fi", "Loading dock"],
    overview:
      "A 1,400 sq ft daylight studio built around a three-sided infinity cyc wall. Ceiling rigging holds eight strobes on pantograph arms, and the north-facing window wall gives soft, consistent light from 9am to 4pm. Includes a private makeup room, rolling wardrobe racks and a small client lounge.",
    rules: "No smoking. Shoes off on the cyc. Overtime is billed in 30 minute blocks.",
    ownerEmail: "host@studiospace.com",
    ownerName: "Maya Rahman",
    ownerPhoto: USERS[0].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Stage 7 Sound & Cinema Stage",
    category: "Film Stage",
    hourlyRate: 120,
    securityDeposit: 400,
    capacity: 40,
    location: "Tejgaon, Dhaka",
    image: img("photo-1470229722913-7c0e2dbbafd3"),
    gallery: [
      img("photo-1470229722913-7c0e2dbbafd3"),
      img("photo-1497366216548-37526070297c"),
      img("photo-1558618666-fcd25c85cd64"),
    ],
    amenities: ["Silent HVAC", "Blackout curtains", "Grid rigging", "Green room", "Truck access", "3-phase power"],
    overview:
      "A 3,200 sq ft stage with 6.5m clearance, structural rigging grid and a full blackout system. Silent air conditioning keeps dialogue takes clean while the 3-phase power drops support lighting kits and camera dollies. Drive-on access fits a small grip truck.",
    rules: "Fire watch required for open flame. Load-in closes at 9pm.",
    ownerEmail: "studio@studiospace.com",
    ownerName: "Noah Kim",
    ownerPhoto: USERS[2].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Lowlight Podcast Lounge",
    category: "Podcast Lounge",
    hourlyRate: 38,
    securityDeposit: 60,
    capacity: 5,
    location: "Gulshan 2, Dhaka",
    image: img("photo-1571330735066-03aaa9429d89"),
    gallery: [
      img("photo-1571330735066-03aaa9429d89"),
      img("photo-1590602847861-f357a9332bbc"),
      img("photo-1521737604893-d14cc237f11d"),
    ],
    amenities: ["Shure SM7B mics", "Rodecaster Pro", "Acoustic panels", "Multi-cam", "Coffee bar", "Wi-Fi"],
    overview:
      "An acoustically treated lounge for two to four speakers with four Shure SM7B microphones, a Rodecaster Pro II and remote-guest camera feeds. Hosts get a warm, low-light look out of the box with three-point lighting already rigged.",
    rules: "Keep drinks away from the console. No outside recording gear on the main desk.",
    ownerEmail: "host@studiospace.com",
    ownerName: "Maya Rahman",
    ownerPhoto: USERS[0].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Analog Room Music Suite",
    category: "Music Suite",
    hourlyRate: 55,
    securityDeposit: 100,
    capacity: 8,
    location: "Dhanmondi, Dhaka",
    image: img("photo-1516280440614-37939bbacd81"),
    gallery: [
      img("photo-1516280440614-37939bbacd81"),
      img("photo-1493225457124-a3eb161ffa5f"),
      img("photo-1616486338812-3dadae4b4ace"),
    ],
    amenities: ["SSL console", "Vintage drum kit", "Neve preamps", "Amp room", "Isolation booth", "Pro Tools"],
    overview:
      "A live room plus control room tuned for full-band tracking. The SSL Origin console, Neve preamps and a well-kept vintage kit make it possible to capture a whole take in one pass. A separate amp room and iso booth let you layer guitars and vocals without bleed.",
    rules: "Bring your own cymbals. Engineers available for an extra fee.",
    ownerEmail: "studio@studiospace.com",
    ownerName: "Noah Kim",
    ownerPhoto: USERS[2].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Clay & Pigment Workshop",
    category: "Workshop",
    hourlyRate: 30,
    securityDeposit: 40,
    capacity: 14,
    location: "Old Town, Dhaka",
    image: img("photo-1503387762-592deb58ef4e"),
    gallery: [
      img("photo-1503387762-592deb58ef4e"),
      img("photo-1513364776144-60967b0f800f"),
      img("photo-1520390138845-fd2d229dd553"),
    ],
    amenities: ["Pottery wheels", "Kiln access", "Deep sinks", "Easels", "Storage racks", "North light"],
    overview:
      "A hands-on making space with six pottery wheels, a shared kiln, deep clay sinks and long trestle benches. North-facing skylights keep colour work accurate all morning, and every bench has water and power within reach.",
    rules: "Clean your wheel before leaving. Clay is charged per bag.",
    ownerEmail: "host@studiospace.com",
    ownerName: "Maya Rahman",
    ownerPhoto: USERS[0].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Rooftop Editorial Loft",
    category: "Photo Studio",
    hourlyRate: 48,
    securityDeposit: 90,
    capacity: 12,
    location: "Mohakhali, Dhaka",
    image: img("photo-1497366216548-37526070297c"),
    gallery: [
      img("photo-1497366216548-37526070297c"),
      img("photo-1524758631624-e2822e304c36"),
      img("photo-1533929736458-ca588d08c8be"),
    ],
    amenities: ["Skylight", "Seamless paper", "Styling rail", "Espresso", "Elevator", "Wi-Fi"],
    overview:
      "A bright top-floor loft built for editorial and lookbook shoots. The skylight and two window walls deliver diffused daylight, while a 3m seamless paper backdrop covers full-length portraits. Freight elevator access keeps rolling cases easy to move.",
    rules: "No glitter or loose powder. Music at a respectful level after 8pm.",
    ownerEmail: "studio@studiospace.com",
    ownerName: "Noah Kim",
    ownerPhoto: USERS[2].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "The Black Box Dialogue Stage",
    category: "Film Stage",
    hourlyRate: 95,
    securityDeposit: 250,
    capacity: 25,
    location: "Uttara, Dhaka",
    image: img("photo-1497366754035-f200968a6e72"),
    gallery: [
      img("photo-1497366754035-f200968a6e72"),
      img("photo-1558618666-fcd25c85cd64"),
      img("photo-1470229722913-7c0e2dbbafd3"),
    ],
    amenities: ["Dead acoustics", "Pre-rigged lights", "Camera risers", "Monitor desk", "Green room", "Generator backup"],
    overview:
      "A matte black dialogue stage with dead acoustics and a pre-rigged lighting plot for interviews and narrative scenes. Two camera risers and a monitor desk let directors work away from set, and a generator covers load-shedding without interrupting a take.",
    rules: "No open flame. Reset the lighting plot before wrap.",
    ownerEmail: "host@studiospace.com",
    ownerName: "Maya Rahman",
    ownerPhoto: USERS[0].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Signal Room Voice Booth",
    category: "Podcast Lounge",
    hourlyRate: 26,
    securityDeposit: 30,
    capacity: 3,
    location: "Bashundhara, Dhaka",
    image: img("photo-1590602847861-f357a9332bbc"),
    gallery: [
      img("photo-1590602847861-f357a9332bbc"),
      img("photo-1571330735066-03aaa9429d89"),
      img("photo-1516280440614-37939bbacd81"),
    ],
    amenities: ["Neumann TLM 103", "Audient interface", "Zero-bleed booth", "Headphone mix", "Remote patch", "Instant upload"],
    overview:
      "A compact, zero-bleed voice booth for narration, audiobooks and solo episodes. A Neumann TLM 103 into an Audient interface is patched for remote guests, and files upload straight to your drive when the session ends.",
    rules: "30 minute minimum. Bring your own SD card for backups.",
    ownerEmail: "studio@studiospace.com",
    ownerName: "Noah Kim",
    ownerPhoto: USERS[2].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Percussion Annex",
    category: "Music Suite",
    hourlyRate: 42,
    securityDeposit: 70,
    capacity: 6,
    location: "Mirpur, Dhaka",
    image: img("photo-1493225457124-a3eb161ffa5f"),
    gallery: [
      img("photo-1493225457124-a3eb161ffa5f"),
      img("photo-1516280440614-37939bbacd81"),
      img("photo-1571330735066-03aaa9429d89"),
    ],
    amenities: ["Floating floor", "Drum mics", "Amp room", "Lounge", "Parking", "Wi-Fi"],
    overview:
      "A drummer-friendly annex with a floating floor, eight drum microphones and a small amp room next door. The low ceiling cloud controls cymbal splash, making it a reliable room for tracking rhythm sections quickly.",
    rules: "No double kick pedals on the house kit. Amps stay under 100W.",
    ownerEmail: "host@studiospace.com",
    ownerName: "Maya Rahman",
    ownerPhoto: USERS[0].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
  {
    title: "Screenprint & Zine Workshop",
    category: "Workshop",
    hourlyRate: 34,
    securityDeposit: 50,
    capacity: 16,
    location: "Lalmatia, Dhaka",
    image: img("photo-1513364776144-60967b0f800f"),
    gallery: [
      img("photo-1513364776144-60967b0f800f"),
      img("photo-1503387762-592deb58ef4e"),
      img("photo-1521737604893-d14cc237f11d"),
    ],
    amenities: ["Exposure unit", "6-colour press", "Washout sink", "Drying racks", "Paper cutter", "Ventilation"],
    overview:
      "A printmaking floor with a 6-colour carousel press, a vacuum exposure unit and a proper washout sink. Long drying racks and a guillotine let a small team run a full zine edition in an afternoon.",
    rules: "Bring your own screens or rent house screens per colour.",
    ownerEmail: "studio@studiospace.com",
    ownerName: "Noah Kim",
    ownerPhoto: USERS[2].photoURL,
    rating: 0,
    reviewCount: 0,
    totalBookings: 0,
  },
];

const dateInDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

async function main() {
  await ensureIndexes();
  const db = await getDB();
  const users = db.collection("users");
  const studios = db.collection("studios");
  const bookings = db.collection("bookings");
  const reviews = db.collection("reviews");
  const wishlists = db.collection("wishlists");

  if (reset) {
    await Promise.all([
      studios.deleteMany({}),
      bookings.deleteMany({}),
      reviews.deleteMany({}),
      wishlists.deleteMany({}),
    ]);
    console.log("Cleared studios, bookings, reviews and wishlists.");
  }

  const now = new Date();
  for (const user of USERS) {
    const { password, ...rest } = user;
    await users.updateOne(
      { email: user.email },
      {
        $set: { ...rest, updatedAt: now },
        $setOnInsert: {
          password: await bcrypt.hash(password, 10),
          provider: "credentials",
          createdAt: now,
        },
      },
      { upsert: true }
    );
    console.log(`Demo user ready: ${user.email} / ${password}`);
  }

  const existingStudios = await studios.countDocuments({});
  if (existingStudios > 0) {
    console.log(`Skipped studio seeding (${existingStudios} listings already exist). Use --reset to replace.`);
  } else {
    const documents = STUDIOS.map((studio, index) => ({
      ...studio,
      createdAt: new Date(Date.now() - index * 36e5),
      updatedAt: new Date(Date.now() - index * 36e5),
    }));
    await studios.insertMany(documents);
    console.log(`Inserted ${documents.length} studios.`);
  }

  const allStudios = await studios.find({}).sort({ createdAt: -1 }).toArray();
  if (allStudios.length >= 2) {
    const reviewSeed = [
      {
        studio: allStudios[0],
        user: { name: "Araf Chowdhury", email: "creator@studiospace.com", photo: USERS[1].photoURL },
        rating: 5,
        comment:
          "The cyc wall is genuinely seamless and the strobes were already balanced for our look. Load-in was quick and the host stayed reachable the whole shoot.",
      },
      {
        studio: allStudios[0],
        user: { name: "Noah Kim", email: "studio@studiospace.com", photo: USERS[2].photoURL },
        rating: 4,
        comment:
          "Great light and a spotless makeup room. Street noise picks up around noon, so plan dialogue scenes before 11am.",
      },
      {
        studio: allStudios[1],
        user: { name: "Araf Chowdhury", email: "creator@studiospace.com", photo: USERS[1].photoURL },
        rating: 5,
        comment:
          "Silent HVAC actually is silent. We recorded a full dialogue scene without ADR and the grid rigging saved us an hour of setup.",
      },
    ];

    for (const item of reviewSeed) {
      const exists = await reviews.findOne({
        studioId: item.studio._id,
        userEmail: item.user.email,
      });
      if (exists) continue;
      await reviews.insertOne({
        studioId: item.studio._id,
        userEmail: item.user.email,
        userName: item.user.name,
        userPhoto: item.user.photo,
        rating: item.rating,
        comment: item.comment,
        createdAt: new Date(),
      });
    }

    for (const studio of allStudios) {
      const [summary] = await reviews
        .aggregate([
          { $match: { studioId: studio._id } },
          { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
        ])
        .toArray();
      await studios.updateOne(
        { _id: studio._id },
        {
          $set: {
            rating: summary ? Math.round(summary.average * 10) / 10 : 0,
            reviewCount: summary ? summary.count : 0,
          },
        }
      );
    }

    const existingBookings = await bookings.countDocuments({});
    if (!existingBookings) {
      const creator = "creator@studiospace.com";
      const first = allStudios[0];
      const second = allStudios[1];
      const nowDate = new Date();
      const serviceFeeRate = 0.05;
      const buildBooking = (studio, date, startTime, endTime, status, code) => {
        const hours = (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3)) -
          (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)))) / 60;
        const subtotal = Math.round(studio.hourlyRate * hours * 100) / 100;
        const serviceFee = Math.round(subtotal * serviceFeeRate * 100) / 100;
        return {
          bookingCode: code,
          studioId: studio._id,
          studioTitle: studio.title,
          studioImage: studio.image,
          studioCategory: studio.category,
          studioLocation: studio.location,
          hourlyRate: studio.hourlyRate,
          securityDeposit: studio.securityDeposit,
          ownerEmail: studio.ownerEmail,
          ownerName: studio.ownerName,
          userEmail: creator,
          userName: "Araf Chowdhury",
          userPhoto: USERS[1].photoURL,
          date,
          startTime,
          endTime,
          hours,
          guests: 3,
          subtotal,
          serviceFee,
          total: Math.round((subtotal + serviceFee) * 100) / 100,
          note: "Editorial shoot with a three-person crew.",
          status,
          createdAt: nowDate,
          updatedAt: nowDate,
        };
      };

      const demoBookings = [
        buildBooking(first, dateInDays(6), "10:00", "14:00", "Pending", "SS-DEMO01"),
        buildBooking(second, dateInDays(9), "09:00", "13:00", "Confirmed", "SS-DEMO02"),
        buildBooking(first, dateInDays(-14), "11:00", "15:00", "Completed", "SS-DEMO03"),
      ];
      await bookings.insertMany(demoBookings);
      console.log(`Inserted ${demoBookings.length} demo bookings.`);
    }
  }

  console.log("\nSeed complete.");
  console.log("Creator login: creator@studiospace.com / Creator123");
  console.log("Host login:    host@studiospace.com / Host1234");
  await db.client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
