"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
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
                aria-labelledby="terms-title"
                className="bg-white w-full max-w-[700px] max-h-[90vh] sm:max-h-[80vh] rounded-[16px] shadow-sm border border-gray-200 flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 id="terms-title" className="text-lg font-bold text-gray-900">ข้อกำหนดการใช้งาน</h2>
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
                        <h3 className="font-bold text-gray-900 mb-2">1. การยอมรับข้อกำหนด</h3>
                        <p>การเข้าถึงและใช้งานระบบ POS ของ [ชื่อผู้ให้บริการ] ถือว่าท่านได้อ่าน ทำความเข้าใจ และตกลงยอมรับข้อกำหนดการใช้งานฉบับนี้ทุกประการ</p>
                    </section>
                    
                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">2. การสมัครและการสร้างบัญชี</h3>
                        <p>ผู้ใช้งานต้องทำการลงทะเบียนเพื่อสร้างบัญชีร้านค้า โดยต้องเป็นบุคคลหรือนิติบุคคลที่มีความสามารถตามกฎหมายในการทำนิติกรรม</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">3. ความถูกต้องของข้อมูล</h3>
                        <p>ผู้ใช้งานตกลงที่จะให้ข้อมูลที่เป็นความจริง ถูกต้อง เป็นปัจจุบัน และสมบูรณ์ และจะปรับปรุงข้อมูลดังกล่าวให้เป็นปัจจุบันอยู่เสมอ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">4. การรักษาความปลอดภัยของบัญชี</h3>
                        <p>ผู้ใช้งานมีหน้าที่รักษาความลับของชื่อผู้ใช้งานและรหัสผ่าน และต้องรับผิดชอบต่อกิจกรรมทั้งหมดที่เกิดขึ้นภายใต้บัญชีของท่าน</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">5. การใช้งานระบบ POS</h3>
                        <p>ระบบอนุญาตให้ใช้งานเพื่อการจัดการจุดขายและการบริหารร้านค้าของท่านเท่านั้น ห้ามนำระบบไปใช้เพื่อวัตถุประสงค์ที่ผิดกฎหมาย</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">6. การจัดการข้อมูลร้านค้า</h3>
                        <p>ผู้ใช้งานเป็นเจ้าของข้อมูลร้านค้าที่นำเข้าสู่ระบบ โดยมอบสิทธิ์ให้ [ชื่อผู้ให้บริการ] ในการประมวลผลข้อมูลดังกล่าวเพื่อให้บริการตามที่ท่านร้องขอ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">7. การจัดการบัญชีพนักงานและสิทธิ์การเข้าถึง</h3>
                        <p>ผู้ดูแลระบบสามารถสร้างบัญชีพนักงานและกำหนดสิทธิ์การเข้าถึงได้ ผู้ดูแลระบบต้องรับผิดชอบต่อการกระทำของพนักงานภายใต้บัญชีร้านค้านั้น ๆ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">8. ระบบ PIN และความรับผิดชอบของผู้ใช้งาน</h3>
                        <p>หากมีการเปิดใช้งานระบบ PIN รหัส PIN จะใช้เป็นลายมือชื่ออิเล็กทรอนิกส์ในการทำรายการ ผู้ใช้ต้องรักษารหัส PIN ไว้เป็นความลับ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">9. การบันทึกข้อมูลการขาย</h3>
                        <p>ระบบจะบันทึกข้อมูลการขายตามที่ผู้ใช้ทำรายการ [ชื่อผู้ให้บริการ] ไม่รับผิดชอบต่อความคลาดเคลื่อนอันเกิดจากการบันทึกข้อมูลที่ผิดพลาดของผู้ใช้</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">10. การใช้ข้อมูลและรายงาน</h3>
                        <p>ระบบจะสร้างรายงานสรุปข้อมูลให้ท่าน [ชื่อผู้ให้บริการ] อาจนำข้อมูลไปประมวลผลในภาพรวมโดยไม่ระบุตัวตน เพื่อปรับปรุงบริการ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">11. การใช้งานที่ต้องห้าม</h3>
                        <p>ห้ามใช้ระบบในการขายสินค้าผิดกฎหมาย ละเมิดสิทธิ์ของบุคคลอื่น หรือกระทำการใด ๆ ที่ก่อให้เกิดความเสียหายต่อระบบ</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">12. ทรัพย์สินทางปัญญา</h3>
                        <p>ซอฟต์แวร์ โลโก้ และเนื้อหาของระบบ POS เป็นทรัพย์สินทางปัญญาของ [ชื่อผู้ให้บริการ] ห้ามทำการคัดลอก ดัดแปลง หรือวิศวกรรมย้อนกลับ (Reverse Engineer)</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">13. ความพร้อมใช้งานของระบบ</h3>
                        <p>เราพยายามอย่างดีที่สุดในการรักษาระบบให้พร้อมใช้งาน แต่ไม่อาจรับประกันได้ว่าระบบจะไม่มีข้อผิดพลาดหรือการหยุดชะงัก (Downtime)</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">14. การระงับหรือยกเลิกบัญชี</h3>
                        <p>เราขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้งานทันที หากพบว่ามีการละเมิดข้อกำหนดการใช้งานฉบับนี้</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">15. การจำกัดความรับผิด</h3>
                        <p>[ชื่อผู้ให้บริการ] จะไม่รับผิดชอบต่อความสูญเสียทางธุรกิจ ผลกำไร หรือข้อมูล อันเกิดจากการใช้งานหรือการไม่สามารถใช้งานระบบได้</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">16. การแก้ไขข้อกำหนด</h3>
                        <p>เราอาจแก้ไขข้อกำหนดนี้เป็นระยะ การใช้งานระบบต่อหลังจากการเปลี่ยนแปลง ถือว่าท่านยอมรับข้อกำหนดที่แก้ไขแล้ว</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">17. การติดต่อผู้ให้บริการ</h3>
                        <p>หากมีข้อสงสัยเกี่ยวกับข้อกำหนดการใช้งาน กรุณาติดต่อ:<br/>
                        อีเมล: [อีเมลติดต่อ]<br/>
                        เบอร์โทรศัพท์: [เบอร์โทรศัพท์]<br/>
                        ที่อยู่: [ที่อยู่ผู้ให้บริการ]</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 mb-2">18. กฎหมายที่ใช้บังคับ</h3>
                        <p>ข้อกำหนดการใช้งานฉบับนี้อยู่ภายใต้บังคับและการตีความตามกฎหมายแห่งราชอาณาจักรไทย</p>
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