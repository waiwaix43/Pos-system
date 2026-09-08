"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

interface PrivacyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                role="dialog" 
                aria-modal="true" 
                aria-labelledby="privacy-title"
                className="bg-white w-full max-w-[700px] max-h-[90vh] sm:max-h-[80vh] rounded-[16px] shadow-sm border border-gray-200 flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 id="privacy-title" className="text-lg font-bold text-gray-900">นโยบายความเป็นส่วนตัว</h2>
                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                            <span>มีผลบังคับใช้: [DD/MM/YYYY]</span>
                            <span>แก้ไขล่าสุด: [DD/MM/YYYY]</span>
                            <span>Version: 1.0</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors"
                        aria-label="ปิดหน้าต่าง"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-6 overflow-y-auto text-sm text-gray-700 space-y-5">
                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">1. บทนำ</h3>
                        <p>[ชื่อระบบ] ตระหนักถึงความสำคัญของการคุ้มครองข้อมูลส่วนบุคคล นโยบายฉบับนี้อธิบายถึงวิธีการที่เรารวบรวม ใช้ เปิดเผย และรักษาความปลอดภัยข้อมูลของท่านเมื่อใช้บริการระบบ POS</p>
                    </section>
                    
                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">2. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>ข้อมูลบัญชีผู้ใช้งาน:</strong> ชื่อ-นามสกุล, อีเมล, หมายเลขโทรศัพท์ และรหัสผ่าน</li>
                            <li><strong>ข้อมูลร้านค้า:</strong> ชื่อร้าน, สาขา, ที่อยู่ และโลโก้ร้านค้า</li>
                            <li><strong>ข้อมูลพนักงาน:</strong> รายชื่อ, ตำแหน่ง และข้อมูลรหัส PIN สำหรับเข้าใช้งานระบบ</li>
                            <li><strong>ข้อมูลการขายและธุรกรรม:</strong> รายละเอียดบิล, สินค้าที่ขาย และรูปแบบการชำระเงิน</li>
                            <li><strong>ข้อมูลอุปกรณ์และการใช้งานระบบ:</strong> ข้อมูลเบื้องต้นเกี่ยวกับเบราว์เซอร์ที่ใช้เข้าระบบ</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">3. วัตถุประสงค์ในการเก็บและใช้ข้อมูล</h3>
                        <p>เราเก็บข้อมูลเพื่อสร้างและจัดการบัญชีผู้ใช้, ดำเนินการให้บริการระบบ POS, ปรับปรุงคุณภาพการให้บริการ และติดต่อสื่อสารที่เกี่ยวข้องกับบริการ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">4. ฐานทางกฎหมายในการประมวลผลข้อมูล</h3>
                        <p>เราประมวลผลข้อมูลของท่านตามฐานสัญญา (Contract) เพื่อให้บริการตามข้อตกลง และฐานประโยชน์โดยชอบด้วยกฎหมาย (Legitimate Interest)</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">5. การเปิดเผยข้อมูลแก่บุคคลที่สาม</h3>
                        <p>เราจะไม่ขายข้อมูลของท่านให้แก่บุคคลที่สาม เราอาจเปิดเผยข้อมูลเฉพาะเมื่อมีข้อบังคับทางกฎหมาย หรือเป็นไปตามคำสั่งศาลเท่านั้น</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">6. ผู้ให้บริการภายนอก / Service Providers</h3>
                        <p>ปัจจุบัน ระบบประมวลผลและจัดเก็บข้อมูลภายในเซิร์ฟเวอร์ที่บริษัทดูแลจัดการเอง หากในอนาคตมีการใช้บริการโครงสร้างพื้นฐานจากผู้ให้บริการภายนอก (เช่น ระบบเซิร์ฟเวอร์) เราจะดำเนินการให้มั่นใจว่าผู้ให้บริการเหล่านั้นมีมาตรฐานความปลอดภัยที่เหมาะสม</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">7. การรักษาความปลอดภัยของข้อมูล</h3>
                        <p>เรามีมาตรการรักษาความปลอดภัยทางเทคนิคและการบริหารจัดการเพื่อป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต การสูญหาย หรือการเปลี่ยนแปลงข้อมูล</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">8. ระยะเวลาในการเก็บรักษาข้อมูล</h3>
                        <p>เราจะเก็บรักษาข้อมูลของท่านตลอดระยะเวลาที่ท่านเป็นผู้ใช้งานระบบ และจะจัดเก็บเพิ่มเติมเป็นเวลา [ระยะเวลาการเก็บข้อมูล] หลังจากการยกเลิกบัญชีเพื่อวัตถุประสงค์ทางกฎหมาย</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">9. สิทธิของเจ้าของข้อมูล</h3>
                        <p>ท่านมีสิทธิในการขอเข้าถึง ขอแก้ไข ขอระงับการใช้ ขอเพิกถอนความยินยอม หรือขอลบข้อมูลส่วนบุคคลของท่านภายใต้ขอบเขตที่กฎหมายกำหนด</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">10. การใช้ Cookies หรือเทคโนโลยีที่เกี่ยวข้อง</h3>
                        <p>ระบบอาจมีการใช้คุกกี้ที่จำเป็น (Essential Cookies) เพื่อให้ท่านสามารถเข้าสู่ระบบและคงสถานะการล็อกอินได้อย่างปลอดภัย</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">11. การโอนข้อมูล</h3>
                        <p>ข้อมูลของท่านจะถูกจัดเก็บและประมวลผลภายในเซิร์ฟเวอร์ที่อยู่ในประเทศไทย</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">12. การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว</h3>
                        <p>เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นระยะ การเปลี่ยนแปลงใด ๆ จะถูกประกาศให้ทราบผ่านทางระบบ POS</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">13. ช่องทางการติดต่อเกี่ยวกับข้อมูลส่วนบุคคล</h3>
                        <p>หากมีข้อซักถามเกี่ยวกับการคุ้มครองข้อมูลส่วนบุคคล กรุณาติดต่อ:<br/>
                        [ชื่อผู้ควบคุมข้อมูล]<br/>
                        อีเมล: [อีเมลสำหรับติดต่อเรื่องข้อมูลส่วนบุคคล]<br/>
                        ที่อยู่: [ที่อยู่]</p>
                    </section>
                    
                    {/* TODO: แทนที่ Placeholder ด้วยข้อมูลจริงของบริษัท */}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 flex justify-end shrink-0 bg-gray-50 rounded-b-[16px]">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-black text-white font-bold rounded-xl text-sm hover:bg-gray-800 transition-colors"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
}