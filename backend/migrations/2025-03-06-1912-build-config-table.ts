import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the build_configs table
    return knex.schema.createTable("build_configs", (table) => {
        table.increments("id");
        table.string("stack_id", 255).notNullable().index();
        table.integer("repository_id").unsigned().notNullable().references("id").inTable("git_repositories").onDelete("CASCADE");
        table.enum("build_type", ["docker_build", "compose_only", "script"]).notNullable().defaultTo("compose_only");
        table.string("dockerfile_path", 1024).nullable();
        table.string("compose_path", 1024).nullable();
        table.integer("timeout").unsigned().notNullable().defaultTo(3600).comment("Build timeout in seconds");
        table.boolean("auto_deploy_on_push").notNullable().defaultTo(false);
        table.text("auto_deploy_branches").nullable().comment("JSON array of branch patterns to auto-deploy");
        table.string("health_check_path", 1024).nullable();
        table.integer("health_check_timeout").unsigned().nullable();
        table.boolean("rollback_on_failure").notNullable().defaultTo(true);
        table.text("pre_build_commands").nullable().comment("JSON array of commands to run before build");
        table.text("post_build_commands").nullable().comment("JSON array of commands to run after build");
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
        
        // Add a unique constraint to ensure one build config per stack
        table.unique(["stack_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable("build_configs");
}
