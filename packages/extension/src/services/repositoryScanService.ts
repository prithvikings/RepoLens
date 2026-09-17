import { FileRepositoryScanner, type RepositoryMetadata } from "@repolens/core";

export class RepositoryScanService {
  private readonly scanner = new FileRepositoryScanner();

  public scan(rootPath: string): Promise<RepositoryMetadata> {
    return this.scanner.scan(rootPath);
  }
}
