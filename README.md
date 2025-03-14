# React Secure Chat

แอปพลิเคชัน React TypeScript สำหรับการแชทแบบปลอดภัยใช้ ECC และ Shamir's Secret Sharing โดยใช้สัญญาอัจฉริยะ `ECCOperations` และ `KeyShareRegistry`

## คุณสมบัติ

- **การเข้ารหัสแบบ End-to-End**: ข้อความทั้งหมดถูกเข้ารหัสด้วย AES-GCM
- **Perfect Forward Secrecy**: ใช้กุญแจชั่วคราวสำหรับแต่ละข้อความ
- **Shamir's Secret Sharing**: แบ่งกุญแจส่วนตัวเป็นส่วนๆ เพื่อความปลอดภัยและการกู้คืน
- **ไม่ต้องมี MessageRegistry**: จัดเก็บข้อความโดยตรงบน IPFS
- **Web3 Integration**: เชื่อมต่อกับ Ethereum Wallet (เช่น MetaMask)
- **ส่วนติดต่อผู้ใช้แบบโต้ตอบ**: UI ที่ใช้งานง่ายด้วย Chakra UI

## การติดตั้ง

1. โคลนโปรเจค:
   ```
   git clone https://github.com/yourusername/react-secure-chat.git
   cd react-secure-chat
   ```

2. ติดตั้ง Dependencies:
   ```
   npm install
   ```

3. แก้ไขการตั้งค่าสัญญาอัจฉริยะ:
   - แก้ไขที่อยู่สัญญาใน `App.tsx`:
     ```typescript
     const ECC_OPERATIONS_ADDRESS = 'ที่อยู่ของสัญญา ECCOperations ที่ deploy แล้ว';
     const KEY_SHARE_REGISTRY_ADDRESS = 'ที่อยู่ของสัญญา KeyShareRegistry ที่ deploy แล้ว';
     ```

4. รัน Development Server:
   ```
   npm start
   ```

## วิธีการใช้งาน

1. **เชื่อมต่อกระเป๋าเงิน**:
   - คลิกปุ่ม "Connect Wallet" เพื่อเชื่อมต่อกับ MetaMask หรือกระเป๋าเงิน Web3 อื่นๆ

2. **ตั้งค่าข้อมูลผู้ใช้**:
   - ใส่ User ID (เช่น อีเมลหรือชื่อผู้ใช้)
   - คลิก "Initialize Account" เพื่อสร้างกุญแจ ECC และแบ่งไพรเวตคีย์
   - ตั้งรหัสผ่านการกู้คืนที่จะใช้สำหรับเข้ารหัสส่วนของกุญแจ

3. **การส่งข้อความ**:
   - เลือกผู้ติดต่อจากรายการหรือป้อนที่อยู่ ETH ของผู้รับโดยตรง
   - พิมพ์ข้อความและคลิก "Send"
   - ข้อความจะถูกเข้ารหัสและจัดเก็บบน IPFS

4. **การรับข้อความ**:
   - ในแท็บ "Manual Receive" ป้อน CID ของข้อความที่มีคนส่งถึงคุณ
   - ข้อความจะถูกดึงจาก IPFS และถอดรหัส

5. **การจัดการผู้ติดต่อ**:
   - แท็บ "Contacts" แสดงรายชื่อผู้ที่คุณติดต่อด้วย

## โครงสร้างโปรเจค

```
react-secure-chat/
├── public/
├── src/
│   ├── contracts/          # ABIs ของสัญญาอัจฉริยะ
│   ├── services/           # บริการสำหรับการเข้ารหัส/ถอดรหัสและ IPFS
│   │   ├── aesgcm.ts       # การเข้ารหัส/ถอดรหัสด้วย AES-GCM
│   │   ├── ecc-utils.ts    # ยูทิลิตี้สำหรับ ECC
│   │   ├── ipfs-service.ts # บริการ IPFS
│   │   ├── pbkdf2.ts       # การสร้างกุญแจจาก password
│   │   └── shamir-secret-sharing.ts  # การแบ่งและประกอบกุญแจ
│   ├── App.tsx             # คอมโพเนนต์หลักของแอป
│   └── index.tsx
└── package.json
```

## ความปลอดภัย

- **ความปลอดภัยของกุญแจส่วนตัว**: กุญแจส่วนตัวถูกแบ่งด้วย Shamir's Secret Sharing และเข้ารหัสก่อนจัดเก็บ
- **ไม่มีข้อมูลที่ไม่ได้เข้ารหัสบนบล็อกเชน**: มีเพียงกุญแจสาธารณะและ hashes เท่านั้นที่ถูกเก็บบนบล็อกเชน
- **ข้อความถูกเข้ารหัสก่อนจัดเก็บ**: ข้อความถูกเข้ารหัสในระดับไคลเอนต์ก่อนถูกส่งไปยัง IPFS
- **Perfect Forward Secrecy**: ใช้กุญแจที่แตกต่างกันสำหรับแต่ละข้อความ

## การพัฒนาต่อ

- **ระบบการแจ้งเตือน**: เพิ่มระบบการแจ้งเตือนข้อความใหม่
- **การแชทกลุ่ม**: รองรับการแชทแบบหลายคน
- **การส่งไฟล์**: รองรับการส่งไฟล์แบบเข้ารหัส
- **การยืนยันตัวตน**: เพิ่มกลไกการยืนยันตัวตนของผู้ติดต่อ
- **การเชื่อมต่อแบบ P2P**: ใช้ libp2p เพื่อการสื่อสารโดยตรงระหว่างเพียร์

## การกู้คืนกุญแจ

หากคุณสูญเสียการเข้าถึงกุญแจส่วนตัว คุณสามารถกู้คืนโดย:

1. ดึงอย่างน้อย `threshold` ส่วนของกุญแจจากสัญญา KeyShareRegistry
2. ใช้รหัสผ่านการกู้คืนเพื่อถอดรหัสส่วนของกุญแจ
3. ประกอบกุญแจส่วนตัวกลับคืนด้วย Shamir's Secret Sharing

## ข้อจำกัด

- ผู้ใช้ต้องรู้ CID เพื่อรับข้อความ (ในเวอร์ชันนี้)
- ต้องมีการเชื่อมต่อกับ IPFS เพื่อส่งและรับข้อความ
- การจัดเก็บข้อความทั้งหมดอยู่ใน localStorage ซึ่งมีขนาดจำกัด

## สัญญาอนุญาต

MIT