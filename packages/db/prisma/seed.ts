import { createPrismaClient } from "../src/index";
import * as bcrypt from "bcryptjs";
import { SEED_QUESTIONS } from "./seed-questions.js";
import { EXTRA_QUESTIONS } from "./seed-questions-extra.js";
import { NEW_CATEGORY_QUESTIONS } from "./seed-questions-new-categories.js";

const ALL_QUESTIONS = [
  ...SEED_QUESTIONS,
  ...EXTRA_QUESTIONS,
  ...NEW_CATEGORY_QUESTIONS,
];

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 Seeding CarnIA database...");

  // Season inicial
  const now = new Date();
  const seasonEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const season = await prisma.season.upsert({
    where: { id: "season-genesis" },
    update: {},
    create: {
      id: "season-genesis",
      name: "Temporada 1: Génesis",
      startsAt: now,
      endsAt: seasonEnd,
      active: true,
    },
  });
  console.log(`✅ Season activa: ${season.name}`);

  // No borres preguntas existentes: MatchAnswer conserva referencias históricas.
  // El seed anterior hacía deleteMany() y fallaba por FK después de haber borrado
  // las opciones, dejando la base en un estado parcial. Ahora reutilizamos cada
  // pregunta por prompt y solo creamos opciones cuando no existe ninguna.
  let created = 0;
  let updated = 0;
  let optionsRestored = 0;

  for (const [index, q] of ALL_QUESTIONS.entries()) {
    const existing = await prisma.question.findFirst({
      where: { source: "DGT-V1", prompt: q.prompt },
      include: { options: true },
    });

    const questionData = {
      prompt: q.prompt,
      explanation: q.explanation,
      category: q.category,
      difficulty: q.difficulty,
      isTrap: q.isTrap,
      tags: q.tags,
      source: "DGT-V1",
      active: true,
    };

    if (!existing) {
      await prisma.question.create({
        data: {
          id: `seed-dgt-v1-${String(index + 1).padStart(3, "0")}`,
          ...questionData,
          options: {
            create: q.options.map((opt, position) => ({ ...opt, position })),
          },
        },
      });
      created++;
      continue;
    }

    await prisma.question.update({
      where: { id: existing.id },
      data: questionData,
    });
    updated++;

    if (existing.options.length === 0) {
      await prisma.questionOption.createMany({
        data: q.options.map((opt, position) => ({
          questionId: existing.id,
          ...opt,
          position,
        })),
      });
      optionsRestored++;
    } else if (existing.options.length !== q.options.length) {
      console.warn(
        `⚠️  Opciones no modificadas para ${existing.id}: ` +
          `${existing.options.length} existentes, ${q.options.length} esperadas`,
      );
    }
  }
  console.log(
    `✅ Preguntas DGT: ${created} creadas, ${updated} actualizadas, ` +
      `${optionsRestored} juegos de opciones restaurados`,
  );

  // Cuentas demo para testear (password: carnia123)
  const demoUsers = [
    { email: "demo1@carnia.app", username: "jugador_uno" },
    { email: "demo2@carnia.app", username: "jugador_dos" },
  ];
  const passwordHash = await bcrypt.hash("carnia123", 10);

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        rankedStats: {
          create: { elo: 1000, seasonId: season.id },
        },
      },
    });
  }
  console.log(`✅ Usuarios demo creados (password: carnia123)`);
  console.log("🎉 Seed completado");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
