import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { AddressNormalizer } from "../src/lib/address-normalizer";
import { RentCastService } from "../src/services/rentcast-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não configurada no ambiente.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function sanitizeAllClients() {
  console.log("=================================================");
  console.log("Iniciando higienização dos endereços dos clientes");
  console.log("=================================================");

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total de clientes localizados no banco: ${clients.length}\n`);

  let updatedCount = 0;
  let enrichedCount = 0;

  for (const client of clients) {
    if (!client.address) continue;

    const norm = AddressNormalizer.normalize(
      client.address,
      client.city || undefined,
      client.state || undefined,
      client.zipCode || undefined
    );

    const hasAddressChanged =
      norm.street &&
      (norm.street !== client.address ||
        norm.city !== client.city ||
        (norm.zipCode && norm.zipCode !== client.zipCode));

    let newBedrooms = client.bedrooms;
    let newBathrooms = client.bathrooms;
    let newSquareFeet = client.squareFeet;
    let newPropertyType = client.propertyType;

    // Se o cliente ainda não tem dados imobiliários, tenta consultar no RentCast
    const shouldFetchRentCast =
      process.env.RENTCAST_API_KEY &&
      (client.bedrooms === null || client.squareFeet === null) &&
      norm.fullAddress.length >= 8;

    if (shouldFetchRentCast) {
      try {
        const prop = await RentCastService.fetchProperty(norm.fullAddress);
        if (prop && (prop.bedrooms !== null || prop.squareFeet !== null)) {
          newBedrooms = prop.bedrooms;
          newBathrooms = prop.bathrooms;
          newSquareFeet = prop.squareFeet;
          newPropertyType = prop.propertyType;
          enrichedCount++;
          console.log(`  🏠 Imóvel enriquecido [${client.name}]: ${prop.bedrooms}Q / ${prop.bathrooms}B / ${prop.squareFeet} sqft`);
        }
      } catch (err) {
        // Ignora erro para não parar a higienização
      }
    }

    if (
      hasAddressChanged ||
      newBedrooms !== client.bedrooms ||
      newSquareFeet !== client.squareFeet
    ) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          address: norm.street || client.address,
          city: norm.city || client.city,
          state: norm.state || client.state,
          zipCode: norm.zipCode || client.zipCode,
          bedrooms: newBedrooms,
          bathrooms: newBathrooms,
          squareFeet: newSquareFeet,
          propertyType: newPropertyType,
        },
      });

      updatedCount++;
      console.log(`✓ Cliente atualizado [${client.name}]:`);
      console.log(`   Antes: "${client.address.replace(/\n/g, "\\n")}" (${client.city}, ${client.state} ${client.zipCode})`);
      console.log(`   Agora: "${norm.street}" (${norm.city}, ${norm.state} ${norm.zipCode})\n`);
    }
  }

  console.log("=================================================");
  console.log(`Higienização concluída com sucesso!`);
  console.log(`- Clientes com endereços higienizados: ${updatedCount}`);
  console.log(`- Clientes com dados imobiliários enriquecidos: ${enrichedCount}`);
  console.log("=================================================");
}

sanitizeAllClients()
  .catch((err) => {
    console.error("Erro fatal durante higienização:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
