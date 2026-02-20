import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CITY_HUBS } from "@/lib/constants";
import type { Load, Driver, Vehicle } from "./types";

const SHIFTS = [{ value: "day", label: "D?a" }, { value: "night", label: "Noche" }];
const HUBS = CITY_HUBS;
const STATUSES = [
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "blasted", label: "Blasted" },
    { value: "in_progress", label: "In Transit" },
    { value: "arrived_pickup", label: "At Pickup" },
    { value: "arrived_delivery", label: "At Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "failed", label: "Failed" },
];

interface EditLoadDialogProps {
    open: boolean;
    editLoad: Load;
    drivers: Driver[];
    vehicles: Vehicle[];
    selectedDate: string;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onClose: () => void;
}

export default function EditLoadDialog({
    open, editLoad, drivers, vehicles, selectedDate, onSubmit, onClose,
}: EditLoadDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Edit Load</DialogTitle>
                    <DialogDescription>Update load details below.</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Logistics
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div><Label>Date *</Label><Input name="load_date" type="date" defaultValue={editLoad.load_date ?? selectedDate} /></div>
                            <div><Label>Shift</Label>
                                <Select name="shift" defaultValue={editLoad.shift ?? "day"}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Hub</Label>
                                <Select name="hub" defaultValue={editLoad.hub ?? "PHX"}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{HUBS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Reference #</Label><Input name="reference_number" defaultValue={editLoad.reference_number ?? ""} /></div>
                            <div><Label>Driver</Label>
                                <Select name="driver_id" defaultValue={editLoad.driver_id ?? ""}>
                                    <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                                    <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Vehicle</Label>
                                <Select name="vehicle_id" defaultValue={editLoad.vehicle_id ?? ""}>
                                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                                    <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Client Name</Label><Input name="client_name" defaultValue={editLoad.client_name ?? ""} /></div>
                            <div><Label>Service Type</Label>
                                <Select name="service_type" defaultValue={editLoad.service_type ?? "standard"}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AOG">AOG</SelectItem>
                                        <SelectItem value="Courier">Courier</SelectItem>
                                        <SelectItem value="Standard">Standard</SelectItem>
                                        <SelectItem value="standard">Standard (legacy)</SelectItem>
                                        <SelectItem value="same_day">Same Day</SelectItem>
                                        <SelectItem value="rush">Rush</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Status</Label>
                                <Select name="status" defaultValue={editLoad.status ?? "assigned"}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><Label>Pickup Address</Label><Input name="pickup_address" defaultValue={editLoad.pickup_address ?? ""} /></div>
                        <div><Label>Delivery Address</Label><Input name="delivery_address" defaultValue={editLoad.delivery_address ?? ""} /></div>
                        <div><Label>Pickup Company</Label><Input name="pickup_company" defaultValue={editLoad.pickup_company ?? ""} /></div>
                        <div><Label>Delivery Company</Label><Input name="delivery_company" defaultValue={editLoad.delivery_company ?? ""} /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><Label>Miles</Label><Input name="miles" type="number" step="0.1" defaultValue={editLoad.miles ?? ""} /></div>
                        <div><Label>Packages</Label><Input name="packages" type="number" defaultValue={editLoad.packages ?? 1} /></div>
                        <div><Label>Revenue ($)</Label><Input name="revenue" type="number" step="0.01" defaultValue={editLoad.revenue ?? ""} /></div>
                        <div><Label>Driver Pay ($)</Label><Input name="driver_pay" type="number" step="0.01" defaultValue={editLoad.driver_pay ?? ""} /></div>
                        <div><Label>Fuel Cost ($)</Label><Input name="fuel_cost" type="number" step="0.01" defaultValue={editLoad.fuel_cost ?? ""} /></div>
                        <div><Label>Wait (min)</Label><Input name="wait_time_minutes" type="number" defaultValue={editLoad.wait_time_minutes ?? ""} /></div>
                        <div><Label>Start Time</Label><Input name="start_time" type="time" defaultValue={editLoad.start_time ?? ""} /></div>
                        <div><Label>End Time</Label><Input name="end_time" type="time" defaultValue={editLoad.end_time ?? ""} /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div><Label>PO Number</Label><Input name="po_number" defaultValue={editLoad.po_number ?? ""} /></div>
                        <div><Label>Description</Label><Input name="description" defaultValue={editLoad.description ?? ""} /></div>
                        <div><Label>Dimensions</Label><Input name="dimensions_text" defaultValue={editLoad.dimensions_text ?? ""} /></div>
                        <div><Label>SLA Deadline</Label><Input name="sla_deadline" type="datetime-local" defaultValue={editLoad.sla_deadline?.slice(0, 16) ?? ""} /></div>
                        <div><Label>Inbound Tracking</Label><Input name="inbound_tracking" defaultValue={editLoad.inbound_tracking ?? ""} /></div>
                        <div><Label>Outbound Tracking</Label><Input name="outbound_tracking" defaultValue={editLoad.outbound_tracking ?? ""} /></div>
                    </div>
                    <div><Label>Comments</Label><Textarea name="comments" defaultValue={editLoad.comments ?? ""} rows={2} /></div>
                    {/* hidden fields needed by handleSubmit */}
                    <input type="hidden" name="deadhead_miles" value={editLoad.deadhead_miles ?? 0} />
                    <input type="hidden" name="detention_billed" value={editLoad.detention_billed ?? 0} />
                    <input type="hidden" name="shipper_name" value={editLoad.shipper_name ?? ""} />
                    <input type="hidden" name="requested_by" value={editLoad.requested_by ?? ""} />
                    <input type="hidden" name="vehicle_required" value={editLoad.vehicle_required ?? ""} />
                    <input type="hidden" name="inbound_tracking" value={editLoad.inbound_tracking ?? ""} />
                    <input type="hidden" name="outbound_tracking" value={editLoad.outbound_tracking ?? ""} />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="btn-gradient">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
