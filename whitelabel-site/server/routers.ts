import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createLead, getAllLeads, getLeadById } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leads: router({
    create: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("E-mail inválido"),
        phone: z.string().min(10, "Telefone inválido"),
        company: z.string().min(2, "Nome da empresa é obrigatório"),
        role: z.string().min(2, "Cargo é obrigatório"),
        baseSize: z.enum(["< 10k", "10k-50k", "50k-100k", "> 100k"]),
        interestedInFunding: z.boolean(),
        message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres"),
        
        // Hidden fields
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        referrer: z.string().optional(),
        pageVariant: z.string().optional(),
        device: z.string().optional(),
        country: z.string().optional(),
        state: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Calculate score
        let score = 0;
        
        // +3 if base size >= 100k
        if (input.baseSize === "> 100k") {
          score += 3;
        }
        
        // +2 if interested in funding
        if (input.interestedInFunding) {
          score += 2;
        }
        
        // +1 if role contains "Diretor" or "Head"
        if (input.role.toLowerCase().includes("diretor") || 
            input.role.toLowerCase().includes("head")) {
          score += 1;
        }
        
        // Determine tier based on score
        let tier: "A" | "B" | "C" = "C";
        if (score >= 4) {
          tier = "A";
        } else if (score >= 2) {
          tier = "B";
        }
        
        const result = await createLead({
          ...input,
          score,
          tier,
          status: "new",
        });
        
        return {
          success: true,
          leadId: result[0]?.insertId,
          tier,
          score,
        };
      }),
    
    list: protectedProcedure.query(async () => {
      return await getAllLeads();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getLeadById(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
