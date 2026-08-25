import type { GameLang } from "./lang";

export type WordHint = {
  groups: string[];
  traits: string[];
};

const WORD_HINTS_TH: Record<string, WordHint> = {
  มือ: { groups: ["ต่อจากแขน", "อยู่ปลายแขน", "คู่ซ้ายขวา"], traits: ["ใช้จับของ", "มีฝ่าแบน"] },
  นิ้ว: { groups: ["ต่อจากฝ่ามือ", "อยู่ปลายมือ", "เรียงเป็นแถว", "ท่อนเล็กงอได้"], traits: ["มีเล็บ", "งอได้", "ใช้จิ้ม"] },
  นิ้วมือ: { groups: ["ต่อจากฝ่ามือ", "อยู่ปลายมือ"], traits: ["ใช้หยิบของ", "มีเล็บ"] },
  นิ้วเท้า: { groups: ["ต่อจากฝ่าเท้า", "อยู่ปลายเท้า"], traits: ["มีเล็บเล็ก", "อยู่ในรองเท้า"] },
  เท้า: { groups: ["ต่อจากขา", "อยู่ล่างสุดของขา"], traits: ["ใช้เดิน", "ใส่รองเท้า"] },
  ขา: { groups: ["ครึ่งล่างของตัว", "รับน้ำหนักตัว"], traits: ["ใช้เดิน", "มีเข่า"] },
  แขน: { groups: ["ครึ่งบนของตัว", "ห้อยจากไหล่"], traits: ["โบกได้", "มีศอก"] },
  ไหล่: { groups: ["ต่อจากคอลงมา", "หัวมุมท่อนบน"], traits: ["แบกของได้", "เชื่อมกับแขน"] },
  เข่า: { groups: ["พับขาได้", "กลางช่วงขา"], traits: ["นั่งแล้วพับ", "อยู่ระหว่างต้นกับน่อง"] },
  คอ: { groups: ["ต่อจากหัว", "คอดระหว่างหัวกับอก"], traits: ["หันซ้ายขวาได้", "มีสายเสียง"] },
  หัว: { groups: ["อยู่บนสุด", "ส่วนยอดของตัว"], traits: ["มีใบหน้า", "ใส่หมวกได้"] },
  หน้า: { groups: ["ด้านหน้าของหัว", "ส่วนที่คนมอง"], traits: ["มีตาและปาก", "เห็นตอนคุย"] },
  จมูก: { groups: ["กลางใบหน้า", "นูนกลางหน้า"], traits: ["ใช้ดม", "มีรูสองรู"] },
  ปาก: { groups: ["ล่างใบหน้า", "ช่องสำหรับกิน"], traits: ["ใช้พูด", "ใช้กิน"] },
  หู: { groups: ["สองข้างของหัว", "ข้างกะโหลก"], traits: ["ใช้ฟัง", "ใส่ต่างหูได้"] },
  ฟัน: { groups: ["ในช่องปาก", "แถวเหงือก"], traits: ["ใช้เคี้ยว", "สีขาว"] },
  ลิ้น: { groups: ["ในช่องปาก", "กล้ามเนื้อชุ่ม"], traits: ["ใช้ลิ้มรส", "ช่วยพูด"] },
  ผม: { groups: ["บนศีรษะ", "งอกจากหนังหัว"], traits: ["ตัดได้", "หวีได้"] },
  ผิว: { groups: ["ชั้นนอกของตัว", "คลุมทั้งร่าง"], traits: ["โดนแดดได้", "ลูบแล้วรู้สึก"] },
  กระดูก: { groups: ["โครงข้างใน", "ส่วนแข็งในร่าง"], traits: ["ค้ำร่าง", "หักได้"] },
  ท้อง: { groups: ["กลางลำตัว", "ใต้ชายโครง"], traits: ["กินแล้วพอง", "อยู่ใต้หน้าอก"] },
  หน้าอก: { groups: ["ท่อนบนลำตัว", "ใต้คอ"], traits: ["มีซี่โครง", "หายใจแล้วขึ้นลง"] },
  หลัง: { groups: ["ด้านท้ายลำตัว", "ตรงข้ามอก"], traits: ["นอนทับได้", "มีกระดูกสัน"] },
  เอว: { groups: ["คอดกลางตัว", "เหนือสะโพก"], traits: ["รัดเข็มขัด", "คอดที่สุด"] },
  สมอง: { groups: ["ในกะโหลก", "ส่วนในหัว"], traits: ["ใช้คิด", "ควบคุมร่าง"] },
  หัวใจ: { groups: ["ในอกซ้าย", "อวัยวะในอก"], traits: ["สูบฉีดเลือด", "เต้นเป็นจังหวะ"] },
  เลือด: { groups: ["ไหลในเส้น", "ของเหลวในร่าง"], traits: ["สีแดง", "เมื่อบาดไหลออก"] },
  น้ำตา: { groups: ["ออกจากตา", "ของเหลวที่เบ้า"], traits: ["เมื่อร้องไห้", "เค็ม"] },
  เหงื่อ: { groups: ["ออกจากผิว", "เมื่อร้อน"], traits: ["ทำให้เปียก", "มีกลิ่น"] },
  ลมหายใจ: { groups: ["เข้าออกจากปอด", "อากาศในอก"], traits: ["จำเป็นต่อชีวิต", "รู้สึกที่รูจมูก"] },
  เสียง: { groups: ["ได้ยินได้", "คลื่นจากปาก"], traits: ["ออกตอนพูด", "มีดังค่อย"] },
  ร่างกาย: { groups: ["ทั้งตัวคน", "โครงร่างทั้งหมด"], traits: ["มีหัวแขนขา", "มองเห็นได้"] },
  เล็บ: { groups: ["ส่วนแข็งปลายมือ", "แผ่นปลายนิ้วมือ"], traits: ["ตัดได้", "แข็งกว่าผิว"] },
  แก้ม: { groups: ["ข้างใบหน้า", "สองข้างของปาก"], traits: ["ยิ้มแล้วป่อง", "อยู่ใต้นัยน์"] },
  คาง: { groups: ["ล่างสุดของหน้า", "ใต้ริมฝีปาก"], traits: ["อยู่ใต้ปาก", "มีหนวดได้"] },
  คิ้ว: { groups: ["เหนือเบ้าตา", "โค้งบนหน้าผากล่าง"], traits: ["มีขนโค้ง", "ขยับเมื่อแปลกใจ"] },
  น่อง: { groups: ["หลังขาท่อนล่าง", "นูนหลังแข้ง"], traits: ["ใช้ยืน", "เกร็งเวลาวิ่ง"] },
  ปอด: { groups: ["ในอกสองข้าง", "อวัยวะหายใจ"], traits: ["ใช้หายใจ", "มีซ้ายขวา"] },
  ตับ: { groups: ["ในช่องท้อง", "อวัยวะกรอง"], traits: ["กรองสาร", "อยู่ด้านขวา"] },
  ไต: { groups: ["ในเอวสองข้าง", "อวัยวะคู่"], traits: ["กรองปัสสาวะ", "มีคู่"] },
  ก้อย: { groups: ["ริมสุดของมือ", "เล็กสุดบนมือ"], traits: ["สั้นกว่านิ้วอื่น", "อยู่ริมนอก"] },
  ชี้: { groups: ["อยู่ข้างโป้ง", "ถัดจากนิ้วโป้ง"], traits: ["ใช้ชี้ทิศ", "ยาวเรียว"] },
  ข้อมือ: { groups: ["ต่อแขนกับฝ่า", "ข้อพับมือ"], traits: ["ใส่นาฬิกา", "พับมือได้"] },
  ข้อเท้า: { groups: ["ต่อขากับฝ่าเท้า", "ข้อพับเท้า"], traits: ["บิดได้", "แพลงง่าย"] },
  ฝ่ามือ: { groups: ["ด้านในของมือ", "แผ่นแบนในมือ"], traits: ["มีลายเส้น", "ใช้ตบ"] },
  ฝ่าเท้า: { groups: ["ด้านล่างของเท้า", "แผ่นสัมผัสพื้น"], traits: ["สัมผัสพื้น", "มีรอยเท้า"] },
};

const PEOPLE_HINTS_TH: Record<string, WordHint> = {
  ญาติ: {
    groups: ["สายเลือด", "ในตระกูล"],
    traits: ["รวมลุงป้า", "กว้างกว่าพ่อแม่", "ไม่ใช่คนแปลกหน้า"],
  },
  ครอบครัว: {
    groups: ["กลุ่มคนในบ้าน", "สายเลือดรวมกัน"],
    traits: ["มีหลายรุ่น", "อยู่ด้วยกัน"],
  },
  พ่อ: {
    groups: ["ผู้ปกครองชาย", "รุ่นก่อนในบ้าน"],
    traits: ["มีลูก", "คู่กับแม่"],
  },
  แม่: {
    groups: ["ผู้ปกครองหญิง", "รุ่นก่อนในบ้าน"],
    traits: ["คลอดลูกได้", "คู่กับพ่อ"],
  },
  พี่: {
    groups: ["พี่น้อง", "รุ่นเดียวกันในบ้าน"],
    traits: ["เกิดก่อน", "คนโตกว่า"],
  },
  น้อง: {
    groups: ["พี่น้อง", "รุ่นเดียวกันในบ้าน"],
    traits: ["เกิดทีหลัง", "คนเล็กกว่า"],
  },
  พี่ชาย: { groups: ["พี่น้องชาย", "รุ่นเดียวกันในบ้าน"], traits: ["เกิดก่อน", "เป็นผู้ชาย"] },
  พี่สาว: { groups: ["พี่น้องหญิง", "รุ่นเดียวกันในบ้าน"], traits: ["เกิดก่อน", "เป็นผู้หญิง"] },
  น้องชาย: { groups: ["พี่น้องชาย", "รุ่นเดียวกันในบ้าน"], traits: ["เกิดทีหลัง", "เป็นผู้ชาย"] },
  น้องสาว: { groups: ["พี่น้องหญิง", "รุ่นเดียวกันในบ้าน"], traits: ["เกิดทีหลัง", "เป็นผู้หญิง"] },
  ลูก: { groups: ["รุ่นลูกในบ้าน", "สายตรง"], traits: ["เกิดจากพ่อแม่", "ถูกเลี้ยงดู"] },
  ลูกชาย: { groups: ["รุ่นลูกผู้ชาย", "สายตรง"], traits: ["เป็นผู้ชาย", "ถูกเลี้ยงดู"] },
  ลูกสาว: { groups: ["รุ่นลูกผู้หญิง", "สายตรง"], traits: ["เป็นผู้หญิง", "ถูกเลี้ยงดู"] },
  ปู่: { groups: ["รุ่นปู่ย่า", "ฝ่ายพ่อ"], traits: ["พ่อของพ่อ", "สูงสองรุ่น"] },
  ย่า: { groups: ["รุ่นปู่ย่า", "ฝ่ายพ่อ"], traits: ["แม่ของพ่อ", "สูงสองรุ่น"] },
  ตา: { groups: ["รุ่นตายาย", "ฝ่ายแม่"], traits: ["พ่อของแม่", "สูงสองรุ่น"] },
  ยาย: { groups: ["รุ่นตายาย", "ฝ่ายแม่"], traits: ["แม่ของแม่", "สูงสองรุ่น"] },
  ลุง: { groups: ["พี่ของพ่อแม่", "รุ่นผู้ใหญ่ชาย"], traits: ["ชายรุ่นเดียวกับพ่อแม่", "ไม่ใช่พ่อ"] },
  ป้า: { groups: ["พี่ของพ่อแม่", "รุ่นผู้ใหญ่หญิง"], traits: ["หญิงรุ่นเดียวกับพ่อแม่", "ไม่ใช่แม่"] },
  น้า: { groups: ["น้องของแม่", "รุ่นผู้ใหญ่"], traits: ["น้องของแม่", "ไม่ใช่พ่อแม่"] },
  อา: { groups: ["น้องของพ่อ", "รุ่นผู้ใหญ่"], traits: ["น้องของพ่อ", "ไม่ใช่พ่อแม่"] },
  หลาน: { groups: ["รุ่นหลังลุงป้า", "สายเลือดลงไป"], traits: ["ลูกของพี่น้อง", "เล็กกว่ารุ่นพ่อแม่"] },
  สามี: { groups: ["คู่สมรสชาย", "หลังแต่งงาน"], traits: ["แต่งกับภรรยา", "ไม่ใช่สายเลือด"] },
  ภรรยา: { groups: ["คู่สมรสหญิง", "หลังแต่งงาน"], traits: ["แต่งกับสามี", "ไม่ใช่สายเลือด"] },
  คู่รัก: { groups: ["คนรัก", "ยังไม่ต้องแต่ง"], traits: ["คบกัน", "ไม่ใช่สายเลือด"] },
  แฟน: { groups: ["คนรัก", "ยังไม่ต้องแต่ง"], traits: ["คบกัน", "เรียกคนที่คบ"] },
  เพื่อน: { groups: ["คนสนิท", "ไม่ใช่สายเลือด"], traits: ["คบกันเอง", "ไม่ได้อยู่บ้านเดียวกัน"] },
  เพื่อนบ้าน: { groups: ["คนละบ้านใกล้กัน", "ไม่ใช่สายเลือด"], traits: ["อยู่ใกล้บ้าน", "ไม่ใช่ครอบครัว"] },
  ครู: { groups: ["อาชีพ", "ในโรงเรียน"], traits: ["สอนหนังสือ", "มีนักเรียน"] },
  อาจารย์: { groups: ["อาชีพ", "ในสถานศึกษา"], traits: ["สอนระดับสูง", "มีนักศึกษา"] },
  นักเรียน: { groups: ["ผู้เรียน", "ในโรงเรียน"], traits: ["เรียนหนังสือ", "มีครู"] },
  นักศึกษา: { groups: ["ผู้เรียน", "ในมหาวิทยาลัย"], traits: ["เรียนระดับสูง", "มีอาจารย์"] },
  หมอ: { groups: ["อาชีพ", "ในโรงพยาบาล"], traits: ["รักษาคนป่วย", "ตรวจร่างกาย"] },
  พยาบาล: { groups: ["อาชีพ", "ในโรงพยาบาล"], traits: ["ดูแลคนป่วย", "ช่วยหมอ"] },
  ตำรวจ: { groups: ["อาชีพ", "รักษาความสงบ"], traits: ["จับคนผิด", "ใส่เครื่องแบบ"] },
  ทหาร: { groups: ["อาชีพ", "ป้องกันประเทศ"], traits: ["ถืออาวุธ", "อยู่ในกรม"] },
  ทนาย: { groups: ["อาชีพ", "ในศาล"], traits: ["ว่าความ", "แก้ต่างให้คน"] },
  ผู้พิพากษา: { groups: ["อาชีพ", "ในศาล"], traits: ["ตัดสินคดี", "นั่งบัลลังก์"] },
  นักการเมือง: { groups: ["อาชีพ", "การปกครอง"], traits: ["หาเสียง", "ออกกฎหมาย"] },
  นักกีฬา: { groups: ["อาชีพหรือผู้เล่น", "ในสนาม"], traits: ["แข่งเป็นรอบ", "มีโค้ช"] },
  นักข่าว: { groups: ["อาชีพ", "สื่อ"], traits: ["รายงานเหตุการณ์", "สัมภาษณ์"] },
  นักร้อง: { groups: ["อาชีพ", "บนเวที"], traits: ["ร้องเพลง", "มีคอนเสิร์ต"] },
  นักเขียน: { groups: ["อาชีพ", "ใช้ตัวอักษร"], traits: ["แต่งเรื่อง", "มีหนังสือ"] },
  นักแสดง: { groups: ["อาชีพ", "บนจอหรือเวที"], traits: ["เล่นบท", "มีละครหรือหนัง"] },
  ศิลปิน: { groups: ["อาชีพสร้างงาน", "ด้านศิลปะ"], traits: ["วาดหรือประพันธ์", "มีผลงาน"] },
  ชาวนา: { groups: ["อาชีพ", "ในนา"], traits: ["ปลูกข้าว", "ใช้ไถ"] },
  เกษตรกร: { groups: ["อาชีพ", "เพาะปลูก"], traits: ["ปลูกพืช", "เลี้ยงสัตว์ได้"] },
  ชาวประมง: { groups: ["อาชีพ", "ในน้ำ"], traits: ["จับปลา", "มีเรือ"] },
  ช่าง: { groups: ["อาชีพ", "ใช้มือซ่อมทำ"], traits: ["ซ่อมหรือสร้าง", "มีเครื่องมือ"] },
  คนงาน: { groups: ["อาชีพ", "ใช้แรง"], traits: ["ทำงานจ้าง", "ได้ค่าแรง"] },
  พนักงาน: { groups: ["อาชีพ", "ในบริษัทหรือร้าน"], traits: ["รับเงินเดือน", "มีนายจ้าง"] },
  คนขายของ: { groups: ["อาชีพ", "ในร้านหรือตลาด"], traits: ["ขายของ", "รับเงินจากลูกค้า"] },
  ผู้ขาย: { groups: ["อาชีพ", "ฝั่งขาย"], traits: ["ขายของ", "รับเงิน"] },
  ผู้ซื้อ: { groups: ["ฝั่งซื้อ", "ในตลาด"], traits: ["จ่ายเงิน", "ได้ของ"] },
  ลูกค้า: { groups: ["ฝั่งซื้อ", "ในร้าน"], traits: ["มาซื้อของ", "จ่ายเงิน"] },
  แม่ค้า: { groups: ["อาชีพหญิง", "ในตลาด"], traits: ["ขายของ", "เป็นผู้หญิง"] },
  พ่อครัว: { groups: ["อาชีพ", "ในครัว"], traits: ["ทำอาหาร", "เป็นผู้ชาย"] },
  แม่ครัว: { groups: ["อาชีพ", "ในครัว"], traits: ["ทำอาหาร", "เป็นผู้หญิง"] },
  เชฟ: { groups: ["อาชีพ", "ในครัวร้านอาหาร"], traits: ["ปรุงอาหาร", "มีสูตร"] },
  หัวหน้า: { groups: ["ตำแหน่ง", "เหนือลูกน้อง"], traits: ["สั่งงานได้", "ดูแลทีม"] },
  เจ้านาย: { groups: ["ตำแหน่ง", "เหนือลูกน้อง"], traits: ["เป็นนายจ้าง", "สั่งงานได้"] },
  เจ้าของ: { groups: ["ผู้ถือครอง", "มีสิทธิ์"], traits: ["เป็นเจ้าของสิ่งของ", "ไม่ใช่ลูกจ้าง"] },
  ผู้ชาย: { groups: ["เพศ", "ไม่บอกอาชีพ"], traits: ["เพศชาย", "ไม่ใช่ผู้หญิง"] },
  ผู้หญิง: { groups: ["เพศ", "ไม่บอกอาชีพ"], traits: ["เพศหญิง", "ไม่ใช่ผู้ชาย"] },
  เด็ก: { groups: ["วัย", "ยังไม่โต"], traits: ["ยังเล็ก", "ต้องมีผู้ใหญ่ดูแล"] },
  เด็กชาย: { groups: ["วัยผู้ชาย", "ยังไม่โต"], traits: ["เป็นผู้ชาย", "ยังเล็ก"] },
  เด็กหญิง: { groups: ["วัยผู้หญิง", "ยังไม่โต"], traits: ["เป็นผู้หญิง", "ยังเล็ก"] },
  ทารก: { groups: ["วัยแรกเกิด", "เล็กมาก"], traits: ["ยังดูดนม", "อุ้มได้"] },
  วัยรุ่น: { groups: ["วัยกำลังโต", "ช่วงเรียน"], traits: ["โตกว่าเด็ก", "ยังไม่เป็นผู้ใหญ่"] },
  ผู้ใหญ่: { groups: ["วัยทำงาน", "โตแล้ว"], traits: ["พ้นวัยเด็ก", "ตัดสินใจเองได้"] },
  ผู้สูงอายุ: { groups: ["วัยมาก", "รุ่นอาวุโส"], traits: ["อายุมาก", "เกษียณได้"] },
  ผู้คน: { groups: ["คนหลายคน", "ไม่ใช่คนเดียว"], traits: ["เป็นกลุ่ม", "ในที่สาธารณะ"] },
  คน: { groups: ["มนุษย์ทั่วไป", "ไม่เจาะจงบทบาท"], traits: ["สองขา", "พูดได้"] },
};

const PEOPLE_KINDS: { test: RegExp; groups: string[]; traits: string[] }[] = [
  {
    test: /ญาติ|ครอบครัว|พ่อ|แม่|พี่|น้อง|ลูก|ปู่|ย่า|ตา|ยาย|ลุง|ป้า|น้า|อา|หลาน|สามี|ภรรยา|คู่รัก|แฟน/,
    groups: ["สายเลือดหรือบ้าน", "ในตระกูล"],
    traits: ["เกี่ยวข้องทางบ้าน", "ไม่ใช่อาชีพ"],
  },
  {
    test: /ครู|หมอ|ตำรวจ|ทนาย|ทหาร|นัก|ช่าง|พยาบาล|พนักงาน|ชาวนา|ชาวประมง|เชฟ|อาจารย์|เกษตรกร|คนงาน|ขาย|ครัว|หัวหน้า|เจ้านาย|เจ้าของ|พิพากษา|ศิลปิน/,
    groups: ["อาชีพ", "มีงานทำ"],
    traits: ["ได้เงินจากงาน", "มีที่ทำงาน"],
  },
  {
    test: /เด็ก|ทารก|วัยรุ่น|ผู้ใหญ่|สูงอายุ/,
    groups: ["ช่วงวัย", "บอกความโต"],
    traits: ["เกี่ยวกับอายุ", "ไม่ใช่สายเลือด"],
  },
  {
    test: /ผู้ชาย|ผู้หญิง/,
    groups: ["เพศ", "เพศสภาพ"],
    traits: ["ไม่บอกอาชีพ", "ไม่บอกวัยชัด"],
  },
];

const WORD_HINTS_EN: Record<string, WordHint> = {
  hand: { groups: ["end of the arm"], traits: ["used to grab", "has a palm"] },
  finger: { groups: ["on the hand"], traits: ["has a nail", "can bend"] },
  foot: { groups: ["end of the leg"], traits: ["used to walk", "wears a shoe"] },
  eye: { groups: ["on the face"], traits: ["used to see", "can blink"] },
};

const BODY_REGIONS: { test: RegExp; groups: string[]; traits: string[] }[] = [
  {
    test: /นิ้ว|มือ|แขน|ไหล่|ข้อมือ|ฝ่ามือ|เล็บ|ก้อย|ศอก/,
    groups: ["อยู่แถวแขน", "อยู่ท่อนบน"],
    traits: ["ใช้จับหรือชี้", "งอได้"],
  },
  {
    test: /เท้า|ขา|เข่า|น่อง|ส้น|ฝ่าเท้า|ข้อเท้า/,
    groups: ["อยู่แถวขา", "อยู่ท่อนล่าง"],
    traits: ["ใช้เดินหรือยืน", "รับน้ำหนัก"],
  },
  {
    test: /หัว|ตา|หู|จมูก|ปาก|ผม|หน้า|คิ้ว|ฟัน|ลิ้น|คอ|คาง|แก้ม|หม่อม|กะโหลก|ขมับ/,
    groups: ["อยู่ที่ศีรษะ", "อยู่ส่วนบน"],
    traits: ["ใช้รับรู้", "เห็นตอนคุย"],
  },
  {
    test: /หัวใจ|ปอด|ตับ|ไต|กระเพาะ|ลำไส้|สมอง|เลือด|ท้อง|ไส้/,
    groups: ["อยู่ในลำตัว", "ทำงานข้างใน"],
    traits: ["มองไม่เห็นจากนอก", "จำเป็นต่อชีวิต"],
  },
];

export const VAGUE_TH = new Set([
  "ร่างกาย",
  "มีอยู่ในคน",
  "มีในร่างกาย",
  "เป็นส่วนของคน",
  "อยู่กับตัว",
  "ไม่ใช่สิ่งของ",
  "ใช้ทำงานของร่างกาย",
  "เป็นคำนาม",
  "พบได้ทั่วไป",
  "พบในชีวิตประจำวัน",
  "จับต้องได้",
  "ใช้ในชีวิตประจำวัน",
  "เป็นสิ่งของ",
  "ไปถึงได้",
  "มีตำแหน่ง",
  "เห็นได้รอบตัว",
  "อธิบายด้วยคำ",
  "อยู่ย่านใดย่านหนึ่ง",
  "ไม่ใช่ทั้งตัว",
  "มีหน้าที่เฉพาะ",
  "เป็นบุคคล",
  "อยู่ในสังคม",
  "พูดได้",
  "ไม่ใช่สัตว์",
  "มีอาชีพ",
  "มีตำแหน่งชัดเจน",
]);

export const VAGUE_EN = new Set([
  "part of the body",
  "part of a person",
  "a physical thing",
  "used every day",
  "quite common",
  "found in everyday life",
  "a common noun",
]);

const WEAK_CATEGORY_LABELS = new Set([
  "body",
  "color",
  "feeling",
  "abstract",
  "object",
  "people",
  "activity",
  "nature",
  "place",
]);

export function isWeakCategoryHint(category: string): boolean {
  return WEAK_CATEGORY_LABELS.has(category);
}

export function isVagueClue(clue: string, lang: GameLang): boolean {
  const key = clue.trim().toLowerCase();
  return (lang === "th" ? VAGUE_TH : VAGUE_EN).has(key);
}

const CLUSTERS_TH = [
  ["คน", "บุคคล", "มนุษย์", "สังคม", "เป็นคน", "เป็นบุคคล", "อยู่ในสังคม", "พูดได้", "ไม่ใช่สัตว์", "ผู้คน"],
  ["ร่างกาย", "อวัยวะ", "เป็นอวัยวะ", "มีอยู่ในคน", "มีในร่างกาย"],
  ["สถานที่", "เป็นที่", "เป็นสถานที่", "ไปถึงได้"],
];

function clusterHit(text: string, cluster: string[]): boolean {
  const fold = text.trim().toLowerCase();
  return cluster.some(
    (term) => fold === term || fold === `เป็น${term}` || fold === `อยู่ใน${term}`,
  );
}

export function sharesMeaningCluster(a: string, b: string): boolean {
  for (const cluster of CLUSTERS_TH) {
    if (clusterHit(a, cluster) && clusterHit(b, cluster)) return true;
  }
  return false;
}

export function tooCloseToKnown(clue: string, known: string[]): boolean {
  return known.some((item) => sharesMeaningCluster(clue, item));
}

export type FruitFacts = {
  flesh: Array<"red" | "orange" | "yellow" | "white" | "green" | "purple" | "pink" | "brown">;
  seed: "black" | "white" | "brown" | "none" | "tiny" | "red";
  peel: "thin" | "thick" | "hard" | "spiky";
};

export type AnimalKind =
  | "bird"
  | "snake"
  | "reptile"
  | "amphibian"
  | "fish"
  | "insect"
  | "mammal"
  | "aquatic_mammal";

const FRUIT_FACTS_TH: Record<string, FruitFacts> = {
  กล้วย: { flesh: ["yellow", "white"], seed: "none", peel: "thin" },
  กีวี: { flesh: ["green"], seed: "tiny", peel: "thin" },
  ขนุน: { flesh: ["yellow"], seed: "brown", peel: "thick" },
  ชมพู่: { flesh: ["white", "pink"], seed: "tiny", peel: "thin" },
  ตะขบ: { flesh: ["red"], seed: "tiny", peel: "thin" },
  ทับทิม: { flesh: ["red"], seed: "red", peel: "thick" },
  ฝรั่ง: { flesh: ["white", "pink"], seed: "tiny", peel: "thin" },
  พลับ: { flesh: ["orange"], seed: "brown", peel: "thin" },
  พีช: { flesh: ["yellow", "orange"], seed: "brown", peel: "thin" },
  มะกรูด: { flesh: ["green"], seed: "white", peel: "thin" },
  มะขาม: { flesh: ["brown"], seed: "brown", peel: "thick" },
  มะนาว: { flesh: ["green", "yellow"], seed: "white", peel: "thin" },
  มะปราง: { flesh: ["orange", "yellow"], seed: "brown", peel: "thin" },
  มะม่วง: { flesh: ["yellow", "orange"], seed: "brown", peel: "thin" },
  มะยม: { flesh: ["green"], seed: "tiny", peel: "thin" },
  มะละกอ: { flesh: ["orange", "yellow"], seed: "black", peel: "thin" },
  มะไฟ: { flesh: ["orange", "yellow"], seed: "tiny", peel: "thin" },
  มังคุด: { flesh: ["white"], seed: "brown", peel: "thick" },
  ระกำ: { flesh: ["red", "pink"], seed: "tiny", peel: "thin" },
  ลำไย: { flesh: ["white"], seed: "brown", peel: "thin" },
  ลูกเกด: { flesh: ["red", "purple"], seed: "none", peel: "thin" },
  สละ: { flesh: ["white"], seed: "brown", peel: "spiky" },
  สาลี่: { flesh: ["white"], seed: "brown", peel: "thin" },
  ส้ม: { flesh: ["orange"], seed: "white", peel: "thin" },
  องุ่น: { flesh: ["green", "red", "purple"], seed: "tiny", peel: "thin" },
  เงาะ: { flesh: ["white"], seed: "brown", peel: "thick" },
  เสาวรส: { flesh: ["yellow", "orange"], seed: "black", peel: "thick" },
  แตงโม: { flesh: ["red"], seed: "black", peel: "thick" },
  ทุเรียน: { flesh: ["yellow"], seed: "brown", peel: "spiky" },
  มะพร้าว: { flesh: ["white"], seed: "none", peel: "hard" },
  สับปะรด: { flesh: ["yellow"], seed: "none", peel: "thick" },
  ลิ้นจี่: { flesh: ["white"], seed: "brown", peel: "thick" },
};

const ANIMAL_KIND_TH: Record<string, AnimalKind> = {
  นก: "bird",
  นกฮูก: "bird",
  นกแก้ว: "bird",
  หงส์: "bird",
  ห่าน: "bird",
  เป็ด: "bird",
  งู: "snake",
  งูเห่า: "snake",
  จระเข้: "reptile",
  จิ้งจก: "reptile",
  ตุ๊กแก: "reptile",
  ตะพาบ: "reptile",
  เต่า: "reptile",
  กบ: "amphibian",
  เขียด: "amphibian",
  ปลากัด: "fish",
  ปลาทอง: "fish",
  ด้วง: "insect",
  ผึ้ง: "insect",
  มด: "insect",
  ยุง: "insect",
  หนอน: "insect",
  แมงมุม: "insect",
  แมลงปอ: "insect",
  วาฬ: "aquatic_mammal",
  โลมา: "aquatic_mammal",
  แมวน้ำ: "aquatic_mammal",
  กวาง: "mammal",
  กระรอก: "mammal",
  กระแต: "mammal",
  ควาย: "mammal",
  จิงโจ้: "mammal",
  ช้าง: "mammal",
  ม้า: "mammal",
  ม้าลาย: "mammal",
  ยีราฟ: "mammal",
  ลิง: "mammal",
  วัว: "mammal",
  สิงโต: "mammal",
  สุนัข: "mammal",
  หนู: "mammal",
  หมา: "mammal",
  หมาป่า: "mammal",
  หมี: "mammal",
  เม่น: "mammal",
  เสือ: "mammal",
  แกะ: "mammal",
  แพนด้า: "mammal",
  แพะ: "mammal",
  แมว: "mammal",
  แรด: "mammal",
  โคอาลา: "mammal",
};

const ANIMAL_TRAIT = /ไม่มีขา|มีเกล็ด|มีพิษ|เลื่อย|เลื้อย|บินได้|มีปีก|มีขน|เป็นนก|เป็นงู|มีครีบ|ไม่มีปีก/;
const FRUIT_TRAIT = /เปลือกหนา|เปลือกแข็ง|เปลือกหนาม|เปลือกบาง|เมล็ดขาว|เมล็ดสีขาว|เมล็ดดำ|เมล็ดสีดำ|ผลไม้สี|เนื้อแดง|สุกแล้ว/;
const PERSON_OR_BODY_AS_FRUIT = /เปลือกหนา|เมล็ดขาว|เป็นผลไม้|มีปีก|มีเกล็ด|เลื้อย/;

export function fruitFactsFor(secret: string): FruitFacts | null {
  return FRUIT_FACTS_TH[secret] ?? null;
}

const SECRET_ENGLISH: Record<string, string[]> = {
  กล้วย: ["banana"],
  กีวี: ["kiwi"],
  ขนุน: ["jackfruit"],
  ชมพู่: ["rose apple", "water apple"],
  ตะขบ: ["acerola", "barbados cherry"],
  ทับทิม: ["pomegranate"],
  ฝรั่ง: ["guava"],
  พลับ: ["persimmon"],
  พีช: ["peach"],
  มะกรูด: ["kaffir lime"],
  มะขาม: ["tamarind"],
  มะนาว: ["lime", "lemon"],
  มะปราง: ["marian plum", "gandaria"],
  มะม่วง: ["mango"],
  มะยม: ["star gooseberry"],
  มะละกอ: ["papaya"],
  มะไฟ: ["rambai"],
  มังคุด: ["mangosteen"],
  ระกำ: ["salacca", "rakam"],
  ลำไย: ["longan"],
  ลูกเกด: ["raisin"],
  สละ: ["salak", "snakefruit", "snake fruit"],
  สาลี่: ["pear"],
  ส้ม: ["orange"],
  องุ่น: ["grape"],
  เงาะ: ["rambutan"],
  เสาวรส: ["passion fruit", "passionfruit"],
  แตงโม: ["watermelon"],
  ห่าน: ["goose"],
  เป็ด: ["duck"],
  นก: ["bird"],
  งู: ["snake"],
  งูเห่า: ["cobra"],
  กบ: ["frog"],
  แมว: ["cat"],
  หมา: ["dog"],
  สุนัข: ["dog"],
  ช้าง: ["elephant"],
  วัว: ["cow"],
  ม้า: ["horse"],
  ลิง: ["monkey"],
  เสือ: ["tiger"],
  หมี: ["bear"],
  วาฬ: ["whale"],
  โลมา: ["dolphin"],
};

export function englishNamesFor(secret: string): string[] {
  return SECRET_ENGLISH[secret] ?? [];
}

export function glossNamesOtherSecret(secret: string, meaning: string): string | null {
  const text = meaning.trim().toLowerCase();
  if (!text) return null;
  for (const [word, names] of Object.entries(SECRET_ENGLISH)) {
    if (word === secret) continue;
    if (names.some((name) => name.length >= 4 && text.includes(name))) return word;
  }
  return null;
}

export function animalKindFor(secret: string): AnimalKind | null {
  return ANIMAL_KIND_TH[secret] ?? null;
}

function fruitFactsFail(secret: string, joined: string): string | null {
  const fruit = FRUIT_FACTS_TH[secret];
  if (!fruit) return null;
  if (/เนื้อ/.test(joined)) {
    const colorWord: Record<FruitFacts["flesh"][number], string> = {
      red: "แดง",
      orange: "ส้ม",
      yellow: "เหลือง",
      white: "ขาว",
      green: "เขียว",
      purple: "ม่วง",
      pink: "ชมพู",
      brown: "น้ำตาล",
    };
    for (const [color, thai] of Object.entries(colorWord) as Array<[FruitFacts["flesh"][number], string]>) {
      if (new RegExp(`เนื้อ.{0,10}${thai}|${thai}.{0,6}เนื้อ`).test(joined) && !fruit.flesh.includes(color)) {
        return `wrong-flesh-${color}`;
      }
    }
  }
  if (/เมล็ดขาว|เมล็ดสีขาว/.test(joined) && fruit.seed !== "white") return "white-seed";
  if (/เมล็ดดำ|เมล็ดสีดำ/.test(joined) && fruit.seed !== "black") return "black-seed";
  if (/เปลือกหนา|เปลือกแข็ง|เปลือกหนาม|แกะเปลือก/.test(joined) && fruit.peel === "thin") {
    return "thick-peel";
  }
  if (/เปลือกบาง/.test(joined) && (fruit.peel === "hard" || fruit.peel === "spiky")) {
    return "thin-peel";
  }
  return null;
}

function animalFactsFail(secret: string, joined: string): string | null {
  const kind = ANIMAL_KIND_TH[secret];
  if (!kind) return null;
  if (kind === "bird" && /ไม่มีขา|มีเกล็ด|มีพิษ|เลื่อย|เลื้อย|ไม่มีปีก|เป็นงู/.test(joined)) {
    return "bird-as-snake";
  }
  if (kind === "snake" && /มีขน|มีปีก|บินได้|เป็นนก/.test(joined)) return "snake-as-bird";
  if (kind === "snake" && /(?<!ไม่)มีขา/.test(joined)) return "snake-as-bird";
  if (kind === "mammal" && /มีเกล็ด|ไม่มีขา|เลื้อย|มีครีบ|เป็นงู|เป็นนก/.test(joined)) {
    return "mammal-as-other";
  }
  if (kind === "fish" && /มีขา|มีขน|บินได้|เป็นนก/.test(joined)) return "fish-as-land";
  if (kind === "aquatic_mammal" && /มีเกล็ด|เลื้อย|เป็นงู|มีปีก/.test(joined)) {
    return "whale-as-fish-or-bird";
  }
  if (kind === "amphibian" && /มีขน|มีปีก|บินได้|เป็นนก|มีเกล็ด/.test(joined)) {
    return "frog-as-other";
  }
  return null;
}

/** Local world-knowledge checks for Thai secrets. Returns a reason when hints are false. */
export function hintFactError(
  secret: string,
  hints: string[],
  categories: string[],
): string | null {
  const joined = hints.join(" ");
  const fruitErr = fruitFactsFail(secret, joined);
  if (fruitErr) return fruitErr;
  const animalErr = animalFactsFail(secret, joined);
  if (animalErr) return animalErr;

  const primary = categories[0];
  if ((primary === "fruit" || primary === "vegetable") && ANIMAL_TRAIT.test(joined)) {
    return "plant-as-animal";
  }
  if (primary === "animal" && FRUIT_TRAIT.test(joined)) return "animal-as-fruit";
  if (primary === "people" && PERSON_OR_BODY_AS_FRUIT.test(joined)) return "person-as-fruit-or-animal";
  if (primary === "body" && /เป็นผลไม้|มีเปลือก|เมล็ดขาว|บินได้|มีเกล็ด/.test(joined)) {
    return "body-as-other";
  }

  if (!FRUIT_FACTS_TH[secret] && /เปลือกแข็ง|เปลือกหนาม|เปลือกหนา/.test(joined)) {
    const thick = new Set(["ทุเรียน", "มะพร้าว", "สับปะรด", "แตงโม", "เงาะ", "ลิ้นจี่", "มังคุด", "ขนุน", "เสาวรส", "สละ"]);
    if (!thick.has(secret) && primary !== "object") return "hard-shell";
  }
  return null;
}

const FRUIT_HINTS_TH: Record<string, WordHint> = {
  มะละกอ: {
    groups: ["กินได้", "ผลไม้เนื้อนุ่ม"],
    traits: ["สุกแล้วเนื้อส้ม", "เมล็ดสีดำในโพรง", "เปลือกบางลื่น"],
  },
  มะม่วง: {
    groups: ["กินได้", "ผลไม้ทรงรี"],
    traits: ["เนื้อเหลืองหรือส้ม", "มีเมล็ดใหญ่", "เปลือกบาง"],
  },
  ทับทิม: {
    groups: ["กินได้", "ผลไม้ทรงกลม"],
    traits: ["เม็ดในสีแดง", "เปลือกหนาแข็ง", "แกะเป็นเม็ด"],
  },
  ตะขบ: {
    groups: ["กินได้", "ผลไม้เล็ก"],
    traits: ["เปลือกบางนิ่ม", "ผลเล็กสีแดง", "ไม่ใช่เปลือกแข็ง"],
  },
};

function fruitHintsFromFacts(secret: string): WordHint | null {
  const facts = FRUIT_FACTS_TH[secret];
  if (!facts) return null;
  const peel =
    facts.peel === "thin"
      ? "เปลือกบาง"
      : facts.peel === "spiky"
        ? "เปลือกหนาม"
        : facts.peel === "hard"
          ? "เปลือกแข็ง"
          : "เปลือกหนา";
  const seed =
    facts.seed === "none"
      ? "ไม่มีเมล็ดให้กิน"
      : facts.seed === "tiny"
        ? "เมล็ดเล็ก"
        : `เมล็ดสี${facts.seed === "red" ? "แดง" : facts.seed === "black" ? "ดำ" : facts.seed === "white" ? "ขาว" : "น้ำตาล"}`;
  const flesh = {
    red: "เนื้อแดง",
    orange: "เนื้อส้ม",
    yellow: "เนื้อเหลือง",
    white: "เนื้อขาว",
    green: "เนื้อเขียว",
    purple: "เนื้อม่วง",
    pink: "เนื้อชมพู",
    brown: "เนื้อน้ำตาล",
  }[facts.flesh[0]];
  return { groups: ["กินได้", "ผลไม้"], traits: [flesh, seed, peel] };
}

function hintsFor(secret: string, lang: GameLang, category?: string): WordHint | null {
  if (lang !== "th") return WORD_HINTS_EN[secret] ?? null;
  if (category === "fruit") {
    return FRUIT_HINTS_TH[secret] ?? fruitHintsFromFacts(secret);
  }
  if (category === "people") return PEOPLE_HINTS_TH[secret] ?? null;
  if (category === "body") return WORD_HINTS_TH[secret] ?? null;
  return (
    FRUIT_HINTS_TH[secret] ??
    fruitHintsFromFacts(secret) ??
    PEOPLE_HINTS_TH[secret] ??
    WORD_HINTS_TH[secret] ??
    null
  );
}

export function specificHints(secret: string, lang: GameLang, category?: string): WordHint | null {
  const mapped = hintsFor(secret, lang, category);
  if (mapped) return mapped;
  if (lang !== "th") return null;
  if (category === "body") {
    for (const region of BODY_REGIONS) {
      if (region.test.test(secret)) return { groups: region.groups, traits: region.traits };
    }
  }
  if (category === "people") {
    for (const kind of PEOPLE_KINDS) {
      if (kind.test.test(secret)) return { groups: kind.groups, traits: kind.traits };
    }
  }
  return null;
}
