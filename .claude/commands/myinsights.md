# /myinsights $ARGUMENTS — Capture Debugging Insight

Структурированный захват знаний после решения нетривиальной проблемы.

## When to Use
- После сложного дебага (>30 мин)
- Когда нашёл неочевидное решение
- Когда столкнулся с undocumented behavior
- Когда workaround оказался лучше "правильного" решения

## Template

Добавь запись в `docs/insights.md` (создай файл если не существует):

```markdown
---

## [Дата] $ARGUMENTS

**Symptoms:** Что наблюдали? Какие ошибки?
**Diagnostic:** Что проверяли? Что исключили?
**Root Cause:** Настоящая причина проблемы
**Solution:** Что сделали для исправления
**Prevention:** Как избежать в будущем
**Tags:** #tag1 #tag2 #tag3
```

## Process
1. Запроси у пользователя описание проблемы (если $ARGUMENTS недостаточно)
2. Структурируй по шаблону выше
3. Добавь в docs/insights.md
4. Git commit: `docs: insight — $ARGUMENTS`

## Important
- Пиши конкретно: ошибки, версии, конфиги
- Включай code snippets где релевантно
- Теги помогают искать: #prisma #docker #claude-api #flutter #auth
- Файл автоматически коммитится при завершении сессии (Stop hook)
