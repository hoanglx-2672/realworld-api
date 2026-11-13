import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1794204868583 implements MigrationInterface {
  name = 'InitSchema1794204868583';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "bio" text, "image" character varying, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "body" text NOT NULL, "article_id" integer NOT NULL, "author_id" integer NOT NULL, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_d90243459a697eadb8ad56e9092" UNIQUE ("name"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "slug" character varying NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "body" text NOT NULL, "author_id" integer NOT NULL, CONSTRAINT "UQ_1123ff6815c5b8fec0ba9fec370" UNIQUE ("slug"), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "follows" ("follower_id" integer NOT NULL, "following_id" integer NOT NULL, CONSTRAINT "PK_8109e59f691f0444b43420f6987" PRIMARY KEY ("follower_id", "following_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54b5dc2739f2dea57900933db6" ON "follows"  ("follower_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c518e3988b9c057920afaf2d8c" ON "follows"  ("following_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "article_tags" ("article_id" integer NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_dd79accc42e2f122f6f3ff7588a" PRIMARY KEY ("article_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8c9234a4c4cb37806387f0c9e" ON "article_tags"  ("article_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1325dd0b98ee0f8f673db6ce19" ON "article_tags"  ("tag_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "favorites" ("article_id" integer NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "PK_a9e152dd51d71f08637b6a9ca00" PRIMARY KEY ("article_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d2b1e08e4e234e10a0e5ff5fc" ON "favorites"  ("article_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_35a6b05ee3b624d0de01ee5059" ON "favorites"  ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_e9b498cca509147e73808f9e593" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_e6d38899c31997c45d128a8973b" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD CONSTRAINT "FK_6515da4dff8db423ce4eb841490" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_54b5dc2739f2dea57900933db66" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_c518e3988b9c057920afaf2d8c0" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" ADD CONSTRAINT "FK_f8c9234a4c4cb37806387f0c9e9" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" ADD CONSTRAINT "FK_1325dd0b98ee0f8f673db6ce194" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_0d2b1e08e4e234e10a0e5ff5fc5" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_0d2b1e08e4e234e10a0e5ff5fc5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" DROP CONSTRAINT "FK_1325dd0b98ee0f8f673db6ce194"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" DROP CONSTRAINT "FK_f8c9234a4c4cb37806387f0c9e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_c518e3988b9c057920afaf2d8c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_54b5dc2739f2dea57900933db66"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_6515da4dff8db423ce4eb841490"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e6d38899c31997c45d128a8973b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e9b498cca509147e73808f9e593"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_35a6b05ee3b624d0de01ee5059"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d2b1e08e4e234e10a0e5ff5fc"`,
    );
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1325dd0b98ee0f8f673db6ce19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8c9234a4c4cb37806387f0c9e"`,
    );
    await queryRunner.query(`DROP TABLE "article_tags"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c518e3988b9c057920afaf2d8c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54b5dc2739f2dea57900933db6"`,
    );
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
