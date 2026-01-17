import { z, defineCollection } from 'astro:content';

const courseCollection = defineCollection({
  type: 'content', // v2.5.0+ requires this
  schema: z.object({
    title: z.string(),
    phase: z.string(),
    week: z.number(),
  }),
});

export const collections = {
  'course': courseCollection,
};