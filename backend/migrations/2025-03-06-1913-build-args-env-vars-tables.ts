import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create the build_args table
    await knex.schema.createTable("build_args", (table) => {
        table.increments("id");
        table.integer("build_config_id").unsigned().notNullable().references("id").inTable("build_configs").onDelete("CASCADE");
        table.string("name", 255).notNullable();
        table.string("value", 1024).notNullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
        
        // Add a unique constraint for name within a build config
        table.unique(["build_config_id", "name"]);
    });
    
    // Create the env_vars table
    return knex.schema.createTable("env_vars", (table) => {
        table.increments("id");
        table.integer("build_config_id").unsigned().notNullable().references("id").inTable("build_configs").onDelete("CASCADE");
        table.string("name", 255).notNullable();
        table.text("value").notNullable();
        table.boolean("secret").notNullable().defaultTo(false);
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
        
        // Add a unique constraint for name within a build config
        table.unique(["build_config_id", "name"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("env_vars");
    return knex.schema.dropTable("build_args");
}
