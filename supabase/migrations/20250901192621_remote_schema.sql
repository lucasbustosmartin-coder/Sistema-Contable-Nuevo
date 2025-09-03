

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "simbolo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "moneda" "text" NOT NULL,
    "ultimo_precio" numeric,
    "ultimo_precio_ars" numeric,
    "fecha_actualizacion" timestamp with time zone,
    "creado_en" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activos_moneda_check" CHECK (("moneda" = ANY (ARRAY['ARS'::"text", 'USD'::"text"]))),
    CONSTRAINT "activos_tipo_check" CHECK (("tipo" = ANY (ARRAY['accion'::"text", 'cedear'::"text", 'etf'::"text", 'bono'::"text"])))
);


ALTER TABLE "public"."activos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conceptos_contables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "concepto" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "rubro_id" "uuid",
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."conceptos_contables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entradas_contables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "estado_financiero_id" "uuid" NOT NULL,
    "importe_ars" numeric(15,2) NOT NULL,
    "importe_usd" numeric(15,2) NOT NULL,
    "tipo" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo_cambio_id" "uuid",
    "usuario_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "moneda" "text" DEFAULT 'ARS'::"text",
    "concepto_id" "uuid",
    "archivo_url" "text",
    CONSTRAINT "entradas_contables_tipo_check" CHECK (("tipo" = ANY (ARRAY['Activo Corriente'::"text", 'Activo No Corriente'::"text", 'Pasivo'::"text"])))
);


ALTER TABLE "public"."entradas_contables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estados_financieros" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nombre" "text" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."estados_financieros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubros" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_cambio" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "fecha" "date" NOT NULL,
    "tasa" numeric(10,4) NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."tipos_cambio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transacciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "portafolio_id" "uuid" NOT NULL,
    "activo_id" "uuid" NOT NULL,
    "tipo_operacion" "text" NOT NULL,
    "cantidad" numeric NOT NULL,
    "precio_unitario" numeric NOT NULL,
    "moneda" "text" NOT NULL,
    "fecha" "date" NOT NULL
);


ALTER TABLE "public"."transacciones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activos"
    ADD CONSTRAINT "activos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entradas_contables"
    ADD CONSTRAINT "entradas_contables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estados_financieros"
    ADD CONSTRAINT "estados_financieros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conceptos_contables"
    ADD CONSTRAINT "rubros_contables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_nombre_usuario_id_unique" UNIQUE ("nombre", "usuario_id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_cambio"
    ADD CONSTRAINT "tipos_cambio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transacciones"
    ADD CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_cambio"
    ADD CONSTRAINT "unique_fecha_usuario" UNIQUE ("fecha", "usuario_id");



CREATE INDEX "entradas_contables_estado_financiero_idx" ON "public"."entradas_contables" USING "btree" ("estado_financiero_id");



CREATE INDEX "entradas_contables_fecha_idx" ON "public"."entradas_contables" USING "btree" ("fecha");



CREATE INDEX "entradas_contables_tipo_idx" ON "public"."entradas_contables" USING "btree" ("tipo");



CREATE INDEX "entradas_contables_usuario_id_idx" ON "public"."entradas_contables" USING "btree" ("usuario_id");



CREATE INDEX "estados_financieros_usuario_id_idx" ON "public"."estados_financieros" USING "btree" ("usuario_id");



CREATE INDEX "idx_rubros_contables_usuario" ON "public"."conceptos_contables" USING "btree" ("usuario_id");



CREATE INDEX "idx_rubros_usuario" ON "public"."rubros" USING "btree" ("usuario_id");



CREATE INDEX "tipos_cambio_fecha_idx" ON "public"."tipos_cambio" USING "btree" ("fecha");



CREATE INDEX "tipos_cambio_usuario_id_idx" ON "public"."tipos_cambio" USING "btree" ("usuario_id");



ALTER TABLE ONLY "public"."activos"
    ADD CONSTRAINT "activos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."entradas_contables"
    ADD CONSTRAINT "entradas_contables_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "public"."conceptos_contables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entradas_contables"
    ADD CONSTRAINT "entradas_contables_estado_financiero_id_fkey" FOREIGN KEY ("estado_financiero_id") REFERENCES "public"."estados_financieros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entradas_contables"
    ADD CONSTRAINT "entradas_contables_tipo_cambio_id_fkey" FOREIGN KEY ("tipo_cambio_id") REFERENCES "public"."tipos_cambio"("id");



ALTER TABLE ONLY "public"."entradas_contables"
    ADD CONSTRAINT "entradas_contables_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."estados_financieros"
    ADD CONSTRAINT "estados_financieros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conceptos_contables"
    ADD CONSTRAINT "rubros_contables_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conceptos_contables"
    ADD CONSTRAINT "rubros_contables_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tipos_cambio"
    ADD CONSTRAINT "tipos_cambio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transacciones"
    ADD CONSTRAINT "transacciones_activo_id_fkey" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transacciones"
    ADD CONSTRAINT "transacciones_portafolio_id_fkey" FOREIGN KEY ("portafolio_id") REFERENCES "public"."portfolios"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to create a portfolio for themselves." ON "public"."portfolios" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow authenticated users to delete their own portfolios." ON "public"."portfolios" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow authenticated users to manage their own entries." ON "public"."entradas_contables" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Allow authenticated users to update their own portfolios." ON "public"."portfolios" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow logged-in users to read their own portfolios." ON "public"."portfolios" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Propietario" ON "public"."activos" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own accounting entries" ON "public"."entradas_contables" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Users can manage their own conceptos" ON "public"."conceptos_contables" TO "authenticated" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Users can manage their own financial statements" ON "public"."estados_financieros" TO "authenticated" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Users can manage their own rubros" ON "public"."rubros" TO "authenticated" USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden actualizar estados financieros" ON "public"."estados_financieros" FOR UPDATE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden actualizar sus entradas" ON "public"."entradas_contables" FOR UPDATE USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden actualizar sus propias transacciones." ON "public"."transacciones" FOR UPDATE USING (("auth"."uid"() = ( SELECT "portfolios"."user_id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."id" = "transacciones"."portafolio_id"))));



CREATE POLICY "Usuarios pueden actualizar sus propios rubros" ON "public"."conceptos_contables" FOR UPDATE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden actualizar tipos de cambio" ON "public"."tipos_cambio" FOR UPDATE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden eliminar entradas contables" ON "public"."entradas_contables" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden eliminar estados financieros" ON "public"."estados_financieros" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden eliminar sus propias transacciones." ON "public"."transacciones" FOR DELETE USING (("auth"."uid"() = ( SELECT "portfolios"."user_id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."id" = "transacciones"."portafolio_id"))));



CREATE POLICY "Usuarios pueden eliminar sus propios rubros" ON "public"."conceptos_contables" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden eliminar tipos de cambio" ON "public"."tipos_cambio" FOR DELETE USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden insertar entradas contables" ON "public"."entradas_contables" FOR INSERT WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden insertar estados financieros" ON "public"."estados_financieros" FOR INSERT WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden insertar sus propios rubros" ON "public"."conceptos_contables" FOR INSERT WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden insertar tipos de cambio" ON "public"."tipos_cambio" FOR INSERT WITH CHECK (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden insertar transacciones en sus propios portafoli" ON "public"."transacciones" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "portfolios"."user_id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."id" = "transacciones"."portafolio_id"))));



CREATE POLICY "Usuarios pueden ver sus entradas contables" ON "public"."entradas_contables" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden ver sus estados financieros" ON "public"."estados_financieros" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden ver sus propias transacciones." ON "public"."transacciones" FOR SELECT USING (("auth"."uid"() = ( SELECT "portfolios"."user_id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."id" = "transacciones"."portafolio_id"))));



CREATE POLICY "Usuarios pueden ver sus propios rubros" ON "public"."conceptos_contables" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



CREATE POLICY "Usuarios pueden ver sus tipos de cambio" ON "public"."tipos_cambio" FOR SELECT USING (("auth"."uid"() = "usuario_id"));



ALTER TABLE "public"."activos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conceptos_contables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entradas_contables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estados_financieros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rubros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_cambio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transacciones" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON TABLE "public"."activos" TO "anon";
GRANT ALL ON TABLE "public"."activos" TO "authenticated";
GRANT ALL ON TABLE "public"."activos" TO "service_role";



GRANT ALL ON TABLE "public"."conceptos_contables" TO "anon";
GRANT ALL ON TABLE "public"."conceptos_contables" TO "authenticated";
GRANT ALL ON TABLE "public"."conceptos_contables" TO "service_role";



GRANT ALL ON TABLE "public"."entradas_contables" TO "anon";
GRANT ALL ON TABLE "public"."entradas_contables" TO "authenticated";
GRANT ALL ON TABLE "public"."entradas_contables" TO "service_role";



GRANT ALL ON TABLE "public"."estados_financieros" TO "anon";
GRANT ALL ON TABLE "public"."estados_financieros" TO "authenticated";
GRANT ALL ON TABLE "public"."estados_financieros" TO "service_role";



GRANT ALL ON TABLE "public"."portfolios" TO "anon";
GRANT ALL ON TABLE "public"."portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."rubros" TO "anon";
GRANT ALL ON TABLE "public"."rubros" TO "authenticated";
GRANT ALL ON TABLE "public"."rubros" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_cambio" TO "anon";
GRANT ALL ON TABLE "public"."tipos_cambio" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_cambio" TO "service_role";



GRANT ALL ON TABLE "public"."transacciones" TO "anon";
GRANT ALL ON TABLE "public"."transacciones" TO "authenticated";
GRANT ALL ON TABLE "public"."transacciones" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
