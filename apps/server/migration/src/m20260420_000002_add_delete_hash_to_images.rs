use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Images::Table)
                    .add_column(ColumnDef::new(Images::DeleteHash).string_len(32).null())
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                r#"UPDATE "images"
SET "delete_hash" = replace(gen_random_uuid()::text, '-', '')
WHERE "delete_hash" IS NULL"#,
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Images::Table)
                    .modify_column(ColumnDef::new(Images::DeleteHash).string_len(32).not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_images_delete_hash")
                    .table(Images::Table)
                    .col(Images::DeleteHash)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .name("idx_images_delete_hash")
                    .table(Images::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Images::Table)
                    .drop_column(Images::DeleteHash)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Images {
    Table,
    DeleteHash,
}
