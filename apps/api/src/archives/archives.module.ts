import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ArchivesController } from "./archives.controller";
import { ArchivesService } from "./archives.service";
import { ArchivesRepository } from "./archives.repository";

@Module({
  imports: [AuthModule],
  controllers: [ArchivesController],
  providers: [ArchivesService, ArchivesRepository],
})
export class ArchivesModule {}
