# Contexto

เกมทายคำแบบ [contexto.me](https://contexto.me) — ทายคำลับจาก **ความหมาย** ไม่ใช่ตัวสะกด

แต่ละคำที่ทายจะได้ **rank** จาก semantic similarity ทั้งคลังคำ (embedding + vector DB)

- Rank **1** คือคำลับ
- ตัวเลขน้อย = ใกล้ความหมายมากกว่า
- สีเขียว 1–300 · ส้ม 301–1500 · แดง 1501+

## Stack

- **Next.js** App Router — UI + API
- **Embeddings** — **GloVe 6B 300d** (ค่าเริ่มต้น, แบบเดียวกับ Contexto) หรือ `Xenova/all-MiniLM-L6-v2` / OpenAI `text-embedding-3-small`
- **LanceDB** — vector database ฝังในโปรเจกต์ ไม่ต้องรันเซิร์ฟเวอร์แยก

ตอนสร้าง puzzle ระบบจะ cosine-rank คำทั้งหมดกับคำลับ แล้วเก็บ rank ไว้ ตอนทายจึงแค่ lookup เหมือนเกมต้นฉบับ

## คลังคำ (reference set)

สร้างครั้งเดียวจากแหล่งสาธารณะ แล้ว embed ทั้งชุด — ตอนเล่นไม่เรียก WordNet/API

```bash
npm run build-vocab   # หัวคลัง GloVe ~70k + คัดคำลับจาก WordNet → data/en/vocabulary.txt
npm run seed          # ใส่เวกเตอร์ทั้งคลังลง LanceDB
```

หรือรันต่อกัน: `npm run prepare-data`

แหล่งที่ใช้:

- [GloVe 6B 300d](https://nlp.stanford.edu/projects/glove/) — คลังที่ทายได้ (~70,000 คำ ตามความถี่ แบบเดียวกับ Contexto)
- [OpenSubtitles FrequencyWords](https://github.com/hermitdave/FrequencyWords) (`en_50k.txt`) — ใช้จัดอันดับความถี่ตอนคัดคำลับ
- [Princeton WordNet 3.1](https://wordnet.princeton.edu/) ผ่านแพ็กเกจ `wordnet-db` — กรองคำลับให้เป็น noun ในชีวิตประจำวัน

กฎแบบ Contexto:

- **ทายได้:** ~70,000 คำแรกใน GloVe ที่เป็นตัวอักษรล้วน (รวมรูปผัน เช่น `cats`, `running`) — rank สูงสุดจึงอยู่ในหลักหมื่น ใกล้เกมต้นฉบับ
- **คำลับ:** เฉพาะ noun ในชีวิตประจำวัน (ของ, คน, สัตว์, สถานที่, อาหาร) ไม่ใช้คำกริยาที่บังเอิญเป็น noun ในพจนานุกรม เช่น `see`

ผลเขียนลง `data/en/vocabulary.txt`, `data/en/secrets.txt`, `data/en/vocab-meta.json`

## เล่น

```bash
npm install
npm run seed
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

`npm run seed` ครั้งแรกด้วย GloVe จะดาวน์โหลด `glove.6B.zip` (~822MB) แล้วอ่านเวกเตอร์ของคำในคลัง ใช้เวลาประมาณ 1–5 นาทีตามเน็ต

ถ้ายังใช้ MiniLM อยู่ ให้ใส่ `EMBEDDING_PROVIDER=local` ใน `.env.local` แล้ว seed ใหม่

### Seed ด้วย OpenAI

สร้าง `.env.local`:

```bash
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

แล้วรัน `npm run seed` อีกครั้ง (จะเขียน LanceDB ทับของเดิม)

ห้ามสลับโมเดลกลางทาง ถ้าสลับต้อง seed ใหม่

## วิธีเล่น

1. พิมพ์คำภาษาอังกฤษแล้วกด Enter
2. ดูแถบสีกับเลข rank — ยิ่งแท่งยาวและเขียว ยิ่งใกล้
3. ทายคำที่เกี่ยวข้องในกลุ่มความหมายเดียวกัน
4. **Hint** ได้ 3 ครั้ง แต่ละครั้ง rank จะเหลือประมาณครึ่งหนึ่งของ best (เศษปัดขึ้น) ถ้าอยู่ rank 2 จะได้คำตอบ
5. มีโหมด **Daily** (คำเดิมทั้งวัน) และ **Unlimited**

คำเริ่มต้นที่ดี: `animal`, `food`, `place`, `person`, `object`, `music`, `school`

## API

| Method | Path | ใช้ทำอะไร |
| --- | --- | --- |
| `GET` | `/api/puzzle?date=YYYY-MM-DD` | โหลดดailypuzzle (ไม่ส่งคำลับ) |
| `POST` | `/api/puzzle` `{ "mode": "unlimited" }` | สุ่มรอบใหม่ |
| `POST` | `/api/guess` `{ puzzleId, word }` | ได้ `{ word, rank, correct }` |
| `POST` | `/api/hint` `{ puzzleId, guessed }` | คำใบ้ที่ใกล้กว่า |
| `POST` | `/api/give-up` `{ puzzleId }` | เฉลย + คำใกล้เคียง |

Unknown word จะได้ข้อความแบบต้นฉบับ: `I don't know this word.`
