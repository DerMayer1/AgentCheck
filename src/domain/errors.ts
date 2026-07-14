export class AgentCheckError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class RepositoryAccessError extends AgentCheckError {
  public constructor(message: string) {
    super(message, "REPOSITORY_ACCESS_ERROR");
  }
}
