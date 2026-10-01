from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: str = Field(min_length=1, max_length=128)
    persona: str = "witty"
    spice: int = Field(default=2, ge=1, le=3)

    @field_validator("message")
    @classmethod
    def message_not_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message must not be blank")
        return value.strip()

    @field_validator("persona")
    @classmethod
    def valid_persona(cls, value: str) -> str:
        allowed = {"witty", "romantic", "confident", "sweet"}
        if value not in allowed:
            raise ValueError(f"Persona must be one of: {', '.join(sorted(allowed))}")
        return value
