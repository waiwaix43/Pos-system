"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cropper, { Point, Area } from "react-easy-crop";
import getCroppedImg from "../../utils/cropImage"; // ตรวจสอบ path ให้ตรงกับโปรเจกต์
import { 
    Camera, Eye, EyeOff, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Check, ChevronRight, ChevronLeft
} from "lucide-react";

// นำเข้า Modals
import TermsModal from "../components/TermsModal";
import PrivacyModal from "../components/PrivacyModal";

// กำหนด Version ของเอกสารเพื่อส่งเข้า Backend
const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

export default function RegisterPage() {
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // =====================================
    // FORM STATES
    // =====================================
    const [formData, setFormData] = useState({
        shop_name: "", branch: "", shop_phone: "", shop_email: "", address: "", 
        admin_name: "", admin_email: "", admin_phone: "", password: "", confirmPassword: "",
    });
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasPin, setHasPin] = useState(false);
    const [roles, setRoles] = useState([
        { roleName: "เจ้าของร้าน", pin: "", showPin: false },
        { roleName: "ผู้จัดการ", pin: "", showPin: false }
    ]);
    
    // Consent Checkbox State
    const [acceptTerms, setAcceptTerms] = useState(false);
    
    // Modals State
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

    const [errors, setErrors] = useState<any>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    const [finalLogoBase64, setFinalLogoBase64] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState<number>(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    // =====================================
    // VALIDATIONS 
    // =====================================
    const validateField = (name: string, value: string) => {
        let error = null;
        switch (name) {
            case 'shop_name': if (!value.trim()) error = "กรุณาระบุชื่อร้าน"; break;
            case 'shop_email': 
                if (!value.trim()) error = "กรุณาระบุอีเมลร้าน";
                else if (!/\S+@\S+\.\S+/.test(value)) error = "รูปแบบอีเมลไม่ถูกต้อง";
                break;
            case 'admin_name': if (!value.trim()) error = "กรุณาระบุชื่อ-นามสกุล"; break;
            case 'admin_email':
                if (!value.trim()) error = "กรุณาระบุอีเมลเข้าสู่ระบบ";
                else if (!/\S+@\S+\.\S+/.test(value)) error = "รูปแบบอีเมลไม่ถูกต้อง";
                break;
            case 'password':
                if (!value) error = "กรุณาระบุรหัสผ่าน";
                else if (value.length < 6) error = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
                if (formData.confirmPassword && value !== formData.confirmPassword) {
                    setErrors((prev: any) => ({ ...prev, confirmPassword: "รหัสผ่านไม่ตรงกัน" }));
                } else if (formData.confirmPassword) {
                    setErrors((prev: any) => ({ ...prev, confirmPassword: null }));
                }
                break;
            case 'confirmPassword':
                if (!value) error = "กรุณายืนยันรหัสผ่าน";
                else if (value !== formData.password) error = "รหัสผ่านไม่ตรงกัน";
                break;
        }
        setErrors((prev: any) => ({ ...prev, [name]: error }));
    };

    const validateStep1 = () => {
        let newErrors: any = {};
        if (!formData.shop_name.trim()) newErrors.shop_name = "กรุณาระบุชื่อร้าน";
        if (!formData.shop_email.trim()) newErrors.shop_email = "กรุณาระบุอีเมลร้าน";
        else if (!/\S+@\S+\.\S+/.test(formData.shop_email)) newErrors.shop_email = "รูปแบบอีเมลไม่ถูกต้อง";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        let newErrors: any = {};
        if (!formData.admin_name.trim()) newErrors.admin_name = "กรุณาระบุชื่อ-นามสกุล";
        if (!formData.admin_email.trim()) newErrors.admin_email = "กรุณาระบุอีเมลเข้าสู่ระบบ";
        else if (!/\S+@\S+\.\S+/.test(formData.admin_email)) newErrors.admin_email = "รูปแบบอีเมลไม่ถูกต้อง";

        if (!formData.password) newErrors.password = "กรุณาระบุรหัสผ่าน";
        else if (formData.password.length < 6) newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";

        if (!formData.confirmPassword) newErrors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
        else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "รหัสผ่านไม่ตรงกัน";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        let newErrors: any = {};
        if (hasPin) {
            const usedPins = new Set();
            roles.forEach((r, i) => {
                if (r.pin.length !== 4 || isNaN(Number(r.pin))) {
                    newErrors[`pin_${i}`] = "PIN 4 หลัก";
                } else if (usedPins.has(r.pin)) {
                    newErrors[`pin_${i}`] = "รหัสซ้ำ";
                } else {
                    usedPins.add(r.pin);
                }
            });
        }
        
        if (!acceptTerms) {
            newErrors.terms = "กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อนดำเนินการต่อ";
        }

        setErrors((prev: any) => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const calculatePasswordStrength = (pass: string) => {
        if (pass.length === 0) return 0;
        let strength = 0;
        if (pass.length >= 8) strength += 25;
        if (/[A-Z]/.test(pass)) strength += 25;
        if (/[a-z]/.test(pass)) strength += 25;
        if (/[0-9]/.test(pass)) strength += 25;
        return strength;
    };
    const passwordStrength = calculatePasswordStrength(formData.password);

    // =====================================
    // HANDLERS
    // =====================================
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        validateField(name, value);
    };

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (validateStep1()) setCurrentStep(2);
        } else if (currentStep === 2) {
            if (validateStep2()) setCurrentStep(3);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePrevStep = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleRoleChange = (index: number, field: string, value: string | boolean) => {
        const updatedRoles = [...roles];
        updatedRoles[index] = { ...updatedRoles[index], [field]: value };
        setRoles(updatedRoles);

        if (field === "pin" && typeof value === "string") {
            let error = null;
            if (value.length !== 4 || isNaN(Number(value))) error = "PIN 4 หลัก";
            const allPins = updatedRoles.map(r => r.pin).filter(p => p.length === 4);
            if (allPins.filter(p => p === value).length > 1) error = "รหัสซ้ำ";
            
            setErrors((prev: any) => {
                const newErrs = { ...prev };
                if (error) newErrs[`pin_${index}`] = error;
                else delete newErrs[`pin_${index}`];
                return newErrs;
            });
        }
    };

    const addRole = () => setRoles([...roles, { roleName: "พนักงาน", pin: "", showPin: false }]);
    const removeRole = (index: number) => {
        setRoles(roles.filter((_, i) => i !== index));
        setErrors((prev: any) => {
            const newErrs = { ...prev };
            delete newErrs[`pin_${index}`];
            return newErrs;
        });
    };

    // =====================================
    // IMAGE CROP LOGIC
    // =====================================
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempImageSrc(reader.result as string);
                setIsCropModalOpen(true);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        try {
            if (!tempImageSrc || !croppedAreaPixels) return;
            const croppedImageBase64 = await getCroppedImg(tempImageSrc, croppedAreaPixels);
            setFinalLogoBase64(croppedImageBase64);
            setIsCropModalOpen(false);
            setTempImageSrc(null);
        } catch (e) {
            alert("เกิดข้อผิดพลาดในการตัดรูปภาพ");
        }
    };

    // =====================================
    // SUBMIT
    // =====================================
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        
        // ตรวจสอบ Validation Step 3 และ เช็ค Checkbox
        if (!validateStep3()) return;
        
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                roles: hasPin ? roles : [], 
                profile_image: finalLogoBase64,
                // ข้อมูล Consent ที่ส่งไปบันทึกบน Database
                terms_accepted: acceptTerms,
                privacy_accepted: acceptTerms,
                terms_version: TERMS_VERSION,
                privacy_version: PRIVACY_VERSION,
                consent_at: new Date().toISOString()
            };

            const response = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (response.ok) {
                setShowSuccess(true);
            } else {
                setErrors((prev: any) => ({ ...prev, submit: data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก" }));
            }
        } catch (error) {
            setErrors((prev: any) => ({ ...prev, submit: "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง" }));
        } finally {
            setIsLoading(false);
        }
    };

    if (showSuccess) {
        return (
            <div className="min-h-screen bg-[#d6d6d6] flex items-center justify-center p-4 font-sans">
                <div className="bg-white max-w-md w-full rounded-[24px] shadow-sm border border-gray-200 p-10 text-center animate-in zoom-in-95 fade-in">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200">
                        <CheckCircle className="w-10 h-10 text-black" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">สมัครสมาชิกสำเร็จ!</h2>
                    <p className="text-base text-gray-500 mb-8">ยินดีต้อนรับคุณเข้าสู่ระบบ</p>
                    
                    <button onClick={() => router.push('/')} className="w-full py-4 bg-black text-white rounded-xl font-bold text-base hover:bg-gray-800 transition-colors">
                        เข้าสู่ระบบ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8] flex flex-col items-center py-12 px-4 font-sans">
            <style dangerouslySetInnerHTML={{
                __html: `
                    input[type="password"]::-ms-reveal,
                    input[type="password"]::-ms-clear,
                    input[type="password"]::-webkit-contacts-auto-fill-button,
                    input[type="password"]::-webkit-credentials-auto-fill-button {
                        display: none !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                    }
                `
            }} />

            <div className="w-full max-w-[640px] bg-white rounded-[24px] shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-8 sm:p-10">
                    
                    {/* Header & Stepper */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">สร้างบัญชีผู้ใช้</h1>
                        
                        <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 1 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                                </div>
                                <span className={`text-xs font-medium ${currentStep >= 1 ? 'text-black' : 'text-gray-400'}`}>ข้อมูลร้านค้า</span>
                            </div>
                            <div className={`w-16 h-[2px] mb-6 transition-colors ${currentStep > 1 ? 'bg-black' : 'bg-gray-200'}`} />
                            
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 2 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
                                </div>
                                <span className={`text-xs font-medium ${currentStep >= 2 ? 'text-black' : 'text-gray-400'}`}>ผู้ดูแลระบบ</span>
                            </div>
                            <div className={`w-16 h-[2px] mb-6 transition-colors ${currentStep > 2 ? 'bg-black' : 'bg-gray-200'}`} />

                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep === 3 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    3
                                </div>
                                <span className={`text-xs font-medium ${currentStep === 3 ? 'text-black' : 'text-gray-400'}`}>ความปลอดภัย</span>
                            </div>
                        </div>
                    </div>

                    {errors.submit && (
                        <div className="mb-8 bg-red-50 text-red-600 p-4 rounded-xl text-base font-medium flex items-center gap-3 border border-red-100">
                            <AlertCircle className="w-6 h-6 shrink-0" /> {errors.submit}
                        </div>
                    )}

                    <div className="space-y-8">
                        {/* ===================================== */}
                        {/* STEP 1: ข้อมูลร้านค้า */}
                        {/* ===================================== */}
                        {currentStep === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-center mb-8">
                                    <label className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-black hover:bg-gray-50 transition-all relative overflow-hidden group">
                                        {finalLogoBase64 ? (
                                            <img src={finalLogoBase64} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-gray-400 group-hover:text-black">
                                                <Camera className="w-6 h-6 mb-2" />
                                                <span className="text-xs font-bold">โลโก้ร้าน</span>
                                            </div>
                                        )}
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อร้าน <span className="text-red-500">*</span></label>
                                        <input type="text" name="shop_name" value={formData.shop_name} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.shop_name ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base transition-colors`} placeholder="ตัวอย่าง: คาเฟ่ มินิมอล" />
                                        {errors.shop_name && <p className="text-red-500 text-sm mt-1.5">{errors.shop_name}</p>}
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อสาขา</label>
                                        <input type="text" name="branch" value={formData.branch} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-black text-base transition-colors" placeholder="สาขาหลัก" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมลร้าน <span className="text-red-500">*</span></label>
                                        <input type="email" name="shop_email" value={formData.shop_email} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.shop_email ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base transition-colors`} placeholder="hello@shop.com" />
                                        {errors.shop_email && <p className="text-red-500 text-sm mt-1.5">{errors.shop_email}</p>}
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">เบอร์โทรศัพท์ร้าน</label>
                                        <input type="text" name="shop_phone" value={formData.shop_phone} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-black text-base transition-colors" placeholder="02-XXX-XXXX" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">ที่อยู่ร้าน</label>
                                        <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-black text-base transition-colors" placeholder="123/45 ถนน, เขต/อำเภอ, จังหวัด" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===================================== */}
                        {/* STEP 2: ข้อมูลผู้ดูแลระบบ */}
                        {/* ===================================== */}
                        {currentStep === 2 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                    <input type="text" name="admin_name" value={formData.admin_name} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.admin_name ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base transition-colors`} placeholder="นาย เจ้าของ ร้านค้า" />
                                    {errors.admin_name && <p className="text-red-500 text-sm mt-1.5">{errors.admin_name}</p>}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล (เข้าสู่ระบบ) <span className="text-red-500">*</span></label>
                                        <input type="email" name="admin_email" value={formData.admin_email} onChange={handleChange} className={`w-full px-4 py-3 rounded-xl border ${errors.admin_email ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base transition-colors`} placeholder="admin@shop.com" />
                                        {errors.admin_email && <p className="text-red-500 text-sm mt-1.5">{errors.admin_email}</p>}
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">เบอร์โทรศัพท์</label>
                                        <input type="text" name="admin_phone" value={formData.admin_phone} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-black text-base transition-colors" placeholder="08X-XXX-XXXX" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type={showPassword ? "text" : "password"} 
                                                name="password" 
                                                value={formData.password} 
                                                onChange={handleChange} 
                                                className={`w-full px-4 py-3 pr-12 rounded-xl border ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base`} 
                                                placeholder="••••••••" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)} 
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-colors bg-transparent border-none outline-none"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                                            </button>
                                        </div>
                                        {formData.password && (
                                            <div className="mt-2.5 flex items-center gap-1">
                                                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200">
                                                    <div className={`h-full transition-all duration-300 ${passwordStrength >= 25 ? 'bg-red-500' : ''}`} style={{ width: '25%' }}></div>
                                                    <div className={`h-full transition-all duration-300 ${passwordStrength >= 50 ? 'bg-orange-500' : ''}`} style={{ width: '25%' }}></div>
                                                    <div className={`h-full transition-all duration-300 ${passwordStrength >= 75 ? 'bg-yellow-500' : ''}`} style={{ width: '25%' }}></div>
                                                    <div className={`h-full transition-all duration-300 ${passwordStrength >= 100 ? 'bg-black' : ''}`} style={{ width: '25%' }}></div>
                                                </div>
                                            </div>
                                        )}
                                        {errors.password && <p className="text-red-500 text-sm mt-1.5">{errors.password}</p>}
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่าน <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type={showConfirmPassword ? "text" : "password"} 
                                                name="confirmPassword" 
                                                value={formData.confirmPassword} 
                                                onChange={handleChange} 
                                                className={`w-full px-4 py-3 pr-12 rounded-xl border ${errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base`} 
                                                placeholder="••••••••" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-colors bg-transparent border-none outline-none"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                                            </button>
                                        </div>
                                        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1.5">{errors.confirmPassword}</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===================================== */}
                        {/* STEP 3: ความปลอดภัย & ยืนยัน */}
                        {/* ===================================== */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input type="checkbox" checked={hasPin} onChange={(e) => setHasPin(e.target.checked)} className="peer sr-only" />
                                            <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer-checked:bg-black transition-colors"></div>
                                            <div className="absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                                        </div>
                                        <span className="text-base font-medium text-gray-800">เปิดใช้งานระบบ PIN สำหรับพนักงาน</span>
                                    </label>

                                    {hasPin && (
                                        <div className="space-y-4 bg-gray-50 border border-gray-200 p-5 rounded-xl">
                                            {roles.map((role, index) => (
                                                <div key={index} className="flex gap-3 items-start relative pb-4">
                                                    <select 
                                                        value={role.roleName} 
                                                        onChange={(e) => handleRoleChange(index, "roleName", e.target.value)} 
                                                        className="w-[130px] sm:w-[150px] px-3 py-3 rounded-xl border border-gray-300 outline-none focus:border-black text-sm bg-white shrink-0"
                                                    >
                                                        <option value="เจ้าของร้าน">เจ้าของร้าน</option>
                                                        <option value="ผู้จัดการ">ผู้จัดการ</option>
                                                        <option value="พนักงาน">พนักงาน</option>
                                                    </select>

                                                    <div className="flex-1 relative">
                                                        <input 
                                                            type={role.showPin ? "text" : "password"} 
                                                            placeholder="PIN 4 หลัก" 
                                                            maxLength={4} 
                                                            value={role.pin} 
                                                            onChange={(e) => handleRoleChange(index, "pin", e.target.value.replace(/[^0-9]/g, ''))} 
                                                            className={`w-full px-4 py-3 pr-10 rounded-xl border ${errors[`pin_${index}`] ? 'border-red-500 bg-red-50' : 'border-gray-300'} outline-none focus:border-black text-base text-center tracking-[0.2em] font-bold`} 
                                                        />
                                                        <button type="button" onClick={() => handleRoleChange(index, "showPin", !role.showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 transition-colors">
                                                            {role.showPin ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                                                        </button>
                                                        {errors[`pin_${index}`] && <p className="text-red-500 text-xs mt-1 text-center absolute -bottom-5 w-full">{errors[`pin_${index}`]}</p>}
                                                    </div>

                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeRole(index)} 
                                                        disabled={roles.length <= 1}
                                                        className="w-12 h-[48px] shrink-0 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ))}

                                            <button type="button" onClick={addRole} className="w-full mt-2 py-3 border border-dashed border-gray-300 rounded-xl text-base font-medium text-gray-600 hover:bg-white hover:text-black hover:border-black flex justify-center items-center gap-2 transition-all">
                                                <Plus className="w-5 h-5"/> เพิ่มตำแหน่ง
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-base space-y-3">
                                    <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-200 pb-3">สรุปข้อมูลการสมัคร</h4>
                                    <div className="flex justify-between"><span className="text-gray-500">ชื่อร้าน:</span> <span className="font-medium text-gray-900 text-right">{formData.shop_name} {formData.branch && `(${formData.branch})`}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">อีเมลร้าน:</span> <span className="font-medium text-gray-900 text-right">{formData.shop_email}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">ผู้ดูแลระบบ:</span> <span className="font-medium text-gray-900 text-right">{formData.admin_name}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">อีเมลเข้าสู่ระบบ:</span> <span className="font-medium text-gray-900 text-right">{formData.admin_email}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">ระบบ PIN:</span> <span className="font-medium text-gray-900 text-right">{hasPin ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}</span></div>
                                </div>

                                {/* Checkbox การยอมรับข้อกำหนด (เรียกเปิด Modal) */}
                                <div className={`p-4 rounded-xl border transition-colors ${errors.terms ? 'border-red-300 bg-red-50' : 'border-transparent'}`}>
                                    <label className="flex items-start gap-3 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={acceptTerms} 
                                            onChange={(e) => {
                                                setAcceptTerms(e.target.checked);
                                                if (e.target.checked) setErrors((prev: any) => ({ ...prev, terms: null }));
                                            }} 
                                            className="mt-1 w-5 h-5 text-black border-gray-300 rounded focus:ring-black accent-black shrink-0 cursor-pointer" 
                                        />
                                        <span className="text-base text-gray-600 leading-relaxed">
                                            ฉันได้อ่านและยอมรับ{" "}
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.preventDefault(); setIsTermsOpen(true); }} 
                                                className="text-black font-bold underline hover:text-gray-700 transition-colors"
                                            >
                                                ข้อกำหนดการใช้งาน
                                            </button> 
                                            {" "}และ{" "}
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.preventDefault(); setIsPrivacyOpen(true); }} 
                                                className="text-black font-bold underline hover:text-gray-700 transition-colors"
                                            >
                                                นโยบายความเป็นส่วนตัว
                                            </button>
                                        </span>
                                    </label>
                                    {errors.terms && <p className="text-red-500 text-sm mt-2 ml-8">{errors.terms}</p>}
                                </div>
                            </div>
                        )}
                        
                        {/* ===================================== */}
                        {/* NAVIGATION BUTTONS */}
                        {/* ===================================== */}
                        <div className="pt-8 mt-8 border-t border-gray-100 flex gap-4">
                            {currentStep > 1 && (
                                <button type="button" onClick={handlePrevStep} className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-base hover:bg-gray-50 flex justify-center items-center gap-2 transition-colors">
                                    <ChevronLeft className="w-5 h-5" /> ย้อนกลับ
                                </button>
                            )}
                            
                            {currentStep < 3 ? (
                                <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-black text-white font-bold rounded-xl text-base hover:bg-gray-800 flex justify-center items-center gap-2 transition-colors shadow-sm">
                                    ถัดไป <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button type="button" onClick={handleRegister} disabled={isLoading} className="flex-1 py-4 bg-black text-white font-bold rounded-xl text-base hover:bg-gray-800 flex justify-center items-center gap-2 transition-all shadow-sm disabled:opacity-70">
                                    {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : null}
                                    ลงทะเบียน
                                </button>
                            )}
                        </div>
                    </div>

                    {currentStep === 1 && (
                        <div className="mt-8 text-center">
                            <button onClick={() => router.push('/')} className="text-base text-gray-500 hover:text-black font-medium transition-colors underline">
                                มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Crop Image */}
            {isCropModalOpen && tempImageSrc && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[24px] w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-5 border-b border-gray-100 text-center">
                            <h3 className="text-base font-bold text-gray-900">จัดตำแหน่งโลโก้</h3>
                        </div>
                        <div className="relative h-[320px] w-full bg-gray-900">
                            {/* @ts-ignore */}
                            <Cropper image={tempImageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
                        </div>
                        <div className="px-6 py-5 bg-white flex items-center gap-4">
                            <span className="text-sm font-bold text-gray-600">ซูม</span>
                            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                        </div>
                        <div className="flex w-full gap-3 p-5 border-t border-gray-100 bg-gray-50">
                            <button onClick={() => { setIsCropModalOpen(false); setTempImageSrc(null); }} className="flex-1 py-3.5 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-100 transition-colors text-base">ยกเลิก</button>
                            <button onClick={handleCropConfirm} className="flex-1 py-3.5 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-base">ยืนยัน</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals ข้อกำหนดและนโยบายความเป็นส่วนตัว */}
            <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
            <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
            
        </div>
    );
}